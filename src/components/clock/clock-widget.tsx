import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CaretRightIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  LockSimpleIcon,
  MapPinIcon,
  SignOutIcon,
  TimerIcon,
  WarningCircleIcon,
  WifiSlashIcon,
} from "phosphor-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Icon, useTone } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  ACTION_LOOKS,
  STATUS_LOOKS,
  deriveClock,
  formatBusinessWeekday,
  formatClockTime,
  formatMinutes,
  formatTimer,
  formatWeekday,
  locationNoticeShown,
  shownNotice,
  useClockLocation,
  useClockRead,
  useClockWrites,
  type AttendanceState,
  type ClockAction,
  type ClockStatus,
  type ClockView,
  type DerivedClock,
  type LocationStatus,
  type RetryTarget,
  type ShownNotice,
  type WriteNotice,
} from "@/lib/attendance";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { putMySettings, qk, useMySettings } from "@/lib/query";
import { useNow } from "@/lib/use-now";
import { WEB_PATHS, openWebPage } from "@/lib/web";

import { ClockNotice, NoticeAction } from "./clock-notice";
import { DayTotals } from "./day-totals";
import { GLYPHS } from "./glyphs";
import { LocationLine } from "./location-line";

type Navigate = (href: Href) => void;
type ReadyView = Extract<ClockView, { kind: "ready" }>;

/**
 * The one clock, in both its homes: the Clock sheet and the top of My attendance. It reads
 * `/current` again whenever it mounts, showing a cached answer meanwhile.
 */
export function ClockWidget({
  showAttendanceLink = true,
  onNavigate,
}: {
  showAttendanceLink?: boolean;
  onNavigate: Navigate;
}) {
  const { view, reread } = useClockRead({ rereadOnMount: true });
  const state = view.kind === "ready" ? view.state : null;
  const location = useClockLocation();
  const { busy, notice, act } = useClockWrites(
    state?.organizationId ?? null,
    state?.locationEnabled ? location.capture : undefined
  );
  const locationNotice = useLocationNotice(state);
  const now = useNow(1000);

  return (
    <ClockBody
      view={view}
      now={now}
      busy={busy}
      notice={notice}
      onAct={(action) => void act(action)}
      onReread={reread}
      onNavigate={onNavigate}
      showAttendanceLink={showAttendanceLink}
      location={location.status}
      locationNotice={locationNotice}
    />
  );
}

type LocationNoticeState = { saving: boolean; failed: boolean; onDismiss: () => void };

/**
 * Got it saves through its own mutation rather than `useSaveMySettings`: a failure stays inside
 * the notice card, because toasts are only for writes started outside the sheet.
 */
function useLocationNotice(state: AttendanceState | null): LocationNoticeState | null {
  const queryClient = useQueryClient();
  const settings = useMySettings({ enabled: state?.locationEnabled ?? false }).data;
  const dismissal = useMutation({
    mutationFn: () => putMySettings({ attendanceLocationNoticeDismissed: true }),
    onSuccess: (saved) => queryClient.setQueryData(qk.mySettings(), saved),
  });

  if (!locationNoticeShown(state, settings)) return null;
  return {
    saving: dismissal.isPending,
    failed: dismissal.isError,
    onDismiss: () => {
      haptic("selection");
      dismissal.mutate();
    },
  };
}

type BodyProps = {
  view: ClockView;
  now: number;
  busy: ClockAction | null;
  notice: WriteNotice | null;
  onAct: (action: ClockAction) => void;
  onReread: () => void;
  onNavigate: Navigate;
  showAttendanceLink: boolean;
  location?: LocationStatus;
  locationNotice?: LocationNoticeState | null;
};

/** The widget as a function of what it was handed, so every state renders without a server. */
export function ClockBody(props: BodyProps) {
  const { t } = useTranslation();
  const { view } = props;

  if (view.kind === "loading") return <Skeleton />;
  if (view.kind === "no-employment") {
    return (
      <Text className="py-6 text-center text-[15px] text-muted-foreground">
        {t.clock.noEmployment}
      </Text>
    );
  }
  if (view.kind === "unreachable" || view.kind === "read-failed") {
    const offline = view.kind === "unreachable";
    return (
      <ClockNotice
        testID={offline ? "clock-offline" : "clock-read-failed"}
        tone={offline ? "muted" : "danger"}
        icon={offline ? WifiSlashIcon : WarningCircleIcon}
        title={offline ? t.clock.unreachable : t.clock.serverError}
        body={offline ? t.clock.offlineColdBody : t.clock.serverErrorBody}
      >
        <NoticeAction label={t.clock.tryAgain} icon={ArrowClockwiseIcon} onPress={props.onReread} />
      </ClockNotice>
    );
  }

  const clock = deriveClock(view.state, props.now);
  // Offline, every action waits; only the offline notice's own Try again reads again.
  const disabled = props.busy !== null || view.offline;
  const shown = props.notice ? shownNotice(props.notice, view) : null;

  return (
    <View className="gap-4" testID="clock-widget">
      {props.locationNotice ? <LocationNotice {...props.locationNotice} /> : null}
      <Notices {...props} view={view} clock={clock} shown={shown} disabled={disabled} />
      <StateHead clock={clock} state={view.state} now={props.now} />
      <Actions status={clock.status} busy={props.busy} disabled={disabled} onAct={props.onAct} />
      <LocationLine status={props.location} />
      <DayTotals totals={clock.totals} />
      {props.showAttendanceLink ? (
        <AttendanceRow onPress={() => props.onNavigate("/my-attendance")} />
      ) : null}
    </View>
  );
}

function LocationNotice({ saving, failed, onDismiss }: LocationNoticeState) {
  const { t } = useTranslation();
  const copy = t.clockLocation;
  return (
    <ClockNotice
      testID="clock-location-notice"
      tone="accent"
      icon={MapPinIcon}
      title={copy.noticeTitle}
      body={copy.noticeBody}
    >
      {failed ? (
        <Text className="w-full text-[13.5px] text-danger" testID="clock-location-save-failed">
          {copy.saveFailed}
        </Text>
      ) : null}
      <NoticeAction
        testID="clock-location-got-it"
        label={copy.gotIt}
        icon={CheckIcon}
        disabled={saving}
        onPress={onDismiss}
      />
      <NoticeAction
        testID="clock-location-privacy"
        label={copy.privacy}
        icon={ArrowSquareOutIcon}
        onPress={() => void openWebPage(WEB_PATHS.privacy)}
      />
    </ClockNotice>
  );
}

function Notices({
  view,
  clock,
  shown,
  disabled,
  busy,
  onAct,
  onReread,
  onNavigate,
}: BodyProps & {
  view: ReadyView;
  clock: DerivedClock;
  shown: ShownNotice | null;
  disabled: boolean;
}) {
  const { t, locale } = useTranslation();
  const notices = [];
  const retry = (target: RetryTarget) => (target === "reread" ? onReread() : onAct(target));

  if (view.offline) {
    notices.push(
      <ClockNotice
        key="offline"
        testID="clock-offline"
        tone="muted"
        icon={WifiSlashIcon}
        title={t.clock.unreachable}
        body={t.clock.offlineBody(formatClockTime(new Date(view.readAt).toISOString(), null))}
      >
        <NoticeAction
          testID="clock-try-again"
          label={t.clock.tryAgain}
          icon={ArrowClockwiseIcon}
          onPress={onReread}
        />
      </ClockNotice>
    );
  }

  if (shown?.kind === "network" || shown?.kind === "server") {
    const network = shown.kind === "network";
    notices.push(
      <ClockNotice
        key="retryable"
        testID={network ? "clock-network-failure" : "clock-server-failure"}
        tone="danger"
        icon={network ? WifiSlashIcon : WarningCircleIcon}
        title={network ? t.clock.unreachable : t.clock.serverError}
        body={network ? t.clock.networkBody : t.clock.serverErrorBody}
      >
        <NoticeAction
          testID="clock-retry"
          label={t.request.retry}
          icon={ArrowClockwiseIcon}
          disabled={disabled}
          onPress={() => retry(shown.retry)}
        />
      </ClockNotice>
    );
  } else if (shown?.kind === "already-open") {
    notices.push(
      <ClockNotice
        key="already-open"
        testID="clock-already-open"
        tone="warn"
        icon={ClockIcon}
        title={t.clock.alreadyOpen(shown.since)}
        body={t.clock.alreadyOpenBody}
      />
    );
  } else if (shown) {
    notices.push(
      <ClockNotice
        key="refusal"
        testID="clock-refusal"
        tone="warn"
        icon={WarningCircleIcon}
        title={t.clock.failed}
        body={shown.message ?? t.request.refused}
      />
    );
  }

  const swept = clock.autoClosed;
  if (swept) {
    const length = formatMinutes(swept.minutes);
    const time = formatClockTime(swept.closedAt, swept.timezone);
    const day = formatWeekday(swept.closedAt, locale, swept.timezone);
    const body =
      swept.kind === "break" ? t.clock.autoClosedBreakBody : t.clock.autoClosedSessionBody;
    notices.push(
      <ClockNotice
        key="auto-closed"
        testID="clock-auto-closed"
        tone="warn"
        icon={ClockCounterClockwiseIcon}
        title={t.clock.autoClosedTitle(formatBusinessWeekday(swept.businessDate, locale))}
        body={body(length, time, day)}
      >
        <NoticeAction
          label={t.clock.setTheTime}
          icon={CaretRightIcon}
          onPress={() => onNavigate(`/my-attendance?date=${swept.businessDate}` as Href)}
        />
      </ClockNotice>
    );
  }

  if (clock.status === "inactive") {
    const ended = view.state.employmentEnded;
    notices.push(
      <ClockNotice
        key="inactive"
        testID="clock-inactive"
        tone="muted"
        icon={LockSimpleIcon}
        title={ended ? t.clock.employmentEndedTitle : t.clock.inactiveTitle}
        body={
          ended
            ? t.clock.employmentEndedBody
            : clock.stranded
              ? t.clock.inactiveOpenBody
              : t.clock.inactiveBody
        }
      >
        {clock.stranded ? (
          <NoticeAction
            testID="clock-out"
            label={busy === "clock-out" ? t.clock.clockingOut : t.clock.clockOut}
            icon={SignOutIcon}
            disabled={disabled}
            onPress={() => onAct("clock-out")}
          />
        ) : null}
      </ClockNotice>
    );
  }

  return notices.length ? <View className="gap-2.5">{notices}</View> : null;
}

function StateHead({
  clock,
  state,
  now,
}: {
  clock: DerivedClock;
  state: AttendanceState;
  now: number;
}) {
  const { t } = useTranslation();
  const head = STATUS_LOOKS[clock.status].head;
  const color = useTone(head?.tone ?? "muted");
  if (!head) return null;

  const Glyph = GLYPHS[head.glyph];
  const since = clock.runningSince;
  return (
    <View className="items-center gap-1" testID="clock-state">
      <View className="flex-row items-center gap-1.5">
        <Glyph size={16} color={color} weight="bold" />
        <Text className="text-[14px] font-semibold" style={{ color }} testID="clock-status">
          {t.clock[head.label]}
        </Text>
      </View>
      {since ? (
        <>
          <Text
            className="font-display font-bold text-foreground"
            style={[TABULAR, { fontSize: 56, lineHeight: 62, letterSpacing: -1.5 }]}
            testID="clock-timer"
          >
            {formatTimer(now - new Date(since).getTime())}
          </Text>
          <Text className="text-[14px] text-muted-foreground" style={TABULAR}>
            {(clock.status === "break" ? t.clock.breakSince : t.clock.since)(
              formatClockTime(since, state.timezone)
            )}
          </Text>
        </>
      ) : (
        <Text className="text-[14px] text-muted-foreground">
          {state.sessions.length === 0 ? t.clock.nothingYet : t.clock.today}
        </Text>
      )}
    </View>
  );
}

function Actions({
  status,
  busy,
  disabled,
  onAct,
}: {
  status: ClockStatus;
  busy: ClockAction | null;
  disabled: boolean;
  onAct: (action: ClockAction) => void;
}) {
  const { t } = useTranslation();
  const actions = STATUS_LOOKS[status].actions;
  if (actions.length === 0) return null;

  return (
    <View className="flex-row gap-2.5">
      {actions.map(({ action, kind }) => {
        const look = ACTION_LOOKS[action];
        return (
          <ActionButton
            key={action}
            testID={action}
            kind={kind}
            glyph={look.glyph}
            label={t.clock[busy === action ? look.busyLabel : look.label]}
            busy={busy === action}
            disabled={disabled}
            onPress={() => onAct(action)}
          />
        );
      })}
    </View>
  );
}

function ActionButton({
  kind,
  glyph,
  label,
  busy,
  disabled,
  onPress,
  testID,
}: {
  kind: "primary" | "secondary";
  glyph: keyof typeof GLYPHS;
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const color = useTone(kind === "primary" ? "onPrimary" : "foreground");
  const Glyph = GLYPHS[glyph];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      className={cn(
        "h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full px-4 active:opacity-90",
        kind === "primary" ? "bg-primary" : "border border-input bg-secondary",
        // The pressed button keeps its colour; the spinner already says it is busy.
        disabled && !busy && "opacity-50"
      )}
    >
      {busy ? <ActivityIndicator color={color} /> : <Glyph size={19} color={color} weight="bold" />}
      <Text
        className="text-[16px] font-semibold"
        style={{ color }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AttendanceRow({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      testID="clock-attendance-link"
      accessibilityRole="link"
      className="h-12 flex-row items-center gap-3 rounded-[16px] bg-muted px-4 active:opacity-80"
    >
      <Icon icon={TimerIcon} tone="foreground" size={19} />
      <Text className="flex-1 text-[15px] font-semibold text-foreground">
        {t.clock.viewMyAttendance}
      </Text>
      <Icon icon={CaretRightIcon} tone="muted" size={16} weight="bold" />
    </Pressable>
  );
}

function Skeleton() {
  return (
    <View className="items-center gap-3 py-2" testID="clock-skeleton">
      <View className="h-4 w-28 rounded-full bg-muted" />
      <View className="h-12 w-44 rounded-[12px] bg-muted" />
      <View className="h-3 w-20 rounded-full bg-muted" />
      <View className="mt-3 h-14 w-full rounded-full bg-muted" />
      <View className="mt-2 h-10 w-full rounded-[12px] bg-muted" />
    </View>
  );
}
