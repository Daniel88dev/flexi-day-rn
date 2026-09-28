import {
  ArrowCounterClockwiseIcon,
  ArrowUpRightIcon,
  LockSimpleIcon,
  PencilSimpleLineIcon,
  PlayIcon,
  TrashIcon,
  XIcon,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { ClockNotice } from "@/components/clock/clock-notice";
import { FieldLabel } from "@/components/requests/fields/field-label";
import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import {
  correctableUntil,
  correctionClosed,
  correctionSave,
  correctionSheetErrors,
  correctionSteps,
  defaultTime,
  enteredByName,
  flagsOnSave,
  formatBusinessDay,
  heldDraft,
  heldEdited,
  historyStamp,
  historyText,
  liveDraft,
  rebaseDraft,
  sessionDeletable,
  settleDraft,
  timeFieldOf,
  useClockRead,
  useCorrectSession,
  useDayRead,
  useSessionEvents,
  withBreakAdded,
  withBreakChanged,
  withBreakRemoved,
  withBreakRestored,
  type AttendanceSession,
  type CorrectionErrors,
  type HeldBreak,
  type HeldDraft,
  type SelfServiceWindow,
  type TimeField,
} from "@/lib/attendance";
import { currentMonth, isoDay } from "@/lib/requests/months";
import { useToday } from "@/lib/use-today";

import { AddRow } from "./add-row";
import { EnteredStamp, Flag } from "./chips";
import { useDiscardGuard } from "./discard-guard";
import { FailureNotice, Separator, SheetHeader, SheetRow, TimeCell } from "./sheet-parts";

type Props = {
  sessionId: string;
  businessDate: string;
  viewerId: string | null;
  onClose: () => void;
  onOpenClock: () => void;
};

/**
 * The page sheet that corrects one of the reader's own sessions inside the Self-service window.
 * Every change is held until Save, which sends them in the order the backend's rules need; the
 * rules are the web's correction dialog's, and the backend checks them again.
 */
export function CorrectionSheet({
  sessionId,
  businessDate,
  viewerId,
  onClose,
  onOpenClock,
}: Props) {
  const { t } = useTranslation();
  const { view } = useClockRead();
  const state = view.kind === "ready" ? view.state : null;
  const device = useToday();
  const today = state?.businessDate ?? isoDay(currentMonth(device), device.getDate());
  // `/current` lists today's sessions only; one still open from an earlier day is its
  // `openSession`, and once closed it is that day's to read.
  const [readDate, setReadDate] = useState(businessDate);
  const openOne = state?.openSession?.id === sessionId ? state.openSession : null;
  if (openOne && openOne.businessDate !== readDate) setReadDate(openOne.businessDate);
  const isToday = readDate === today;
  const dayRead = useDayRead(state?.organizationId ?? null, readDate, !isToday);
  const sessions = isToday ? state?.sessions : dayRead.data?.sessions;
  const found = sessions?.find((entry) => entry.id === sessionId) ?? openOne;
  const timezone =
    (isToday ? state?.timezone : dayRead.data?.timezone) ?? state?.timezone ?? found?.timezone;

  const { save, remove, saving, failure } = useCorrectSession();
  const [done, setDone] = useState(false);
  // A delete or a save reads the day again before the sheet goes; the session stays on screen.
  const [shown, setShown] = useState<AttendanceSession | null>(found);
  if (found !== null && found !== shown) setShown(found);
  const session = found ?? (saving || done ? shown : null);

  const [draft, setDraft] = useState<HeldDraft | null>(null);
  const held = session
    ? draft
      ? rebaseDraft(draft, session, timezone ?? null)
      : heldDraft(session, timezone ?? null)
    : null;

  const edited = session !== null && held !== null && heldEdited(session, held, timezone ?? null);
  useDiscardGuard(edited && !done);
  // After the guard has let go, so leaving is not asked about.
  useEffect(() => {
    if (done) onClose();
  }, [done, onClose]);

  const failed = !isToday && dayRead.isError;
  const loading = !session && !failed && (state === null || sessions === undefined);

  const closedBy = state && session ? correctionClosed({ state, session, today }) : null;
  const errors: CorrectionErrors =
    session && held ? correctionSheetErrors(held, session.businessDate, timezone ?? null) : {};
  const steps = session && held ? correctionSteps(session, held, timezone ?? null) : [];
  const button = correctionSave({
    steps,
    errors,
    saving,
    closed: closedBy !== null || session === null,
    failure,
  });

  const body = (() => {
    if (session && held && state) {
      return (
        <SessionForm
          session={session}
          held={held}
          timezone={timezone ?? null}
          today={today}
          window={state.selfService}
          viewerId={viewerId}
          errors={errors}
          saving={saving}
          closed={closedBy !== null}
          onChange={(update) =>
            setDraft((current) =>
              update(
                current
                  ? rebaseDraft(current, session, timezone ?? null)
                  : heldDraft(session, timezone ?? null)
              )
            )
          }
          onOpenClock={onOpenClock}
          onDelete={() =>
            Alert.alert(t.correction.deleteTitle, t.correction.deleteBody, [
              { text: t.correction.keep, style: "cancel" },
              {
                text: t.correction.deleteConfirm,
                style: "destructive",
                onPress: async () => {
                  if (await remove(session.id)) setDone(true);
                },
              },
            ])
          }
        />
      );
    }
    return (
      <Text testID="correction-status" className="px-1 text-[14px] text-muted-foreground">
        {loading ? t.correction.loading : failed ? t.correction.loadFailed : t.correction.gone}
      </Text>
    );
  })();

  const submit = async () => {
    if (!held) return;
    const outcome = await save(steps);
    if (!outcome) return;
    if (outcome.saved) setDone(true);
    else setDraft(settleDraft(held, outcome.landed));
  };

  const pastDay =
    session !== null &&
    closedBy === null &&
    flagsOnSave({ session, today, administersOwn: state?.administersOwnAttendance ?? false });

  return (
    <View testID="correction-sheet" className="flex-1 bg-background">
      <SheetHeader
        title={t.correction.title}
        onCancel={onClose}
        onSave={() => void submit()}
        button={button}
        saving={saving}
        testPrefix="correction"
      />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 48 }}
      >
        {failure ? (
          <FailureNotice failure={failure} testPrefix="correction" fallback={t.correction.failed} />
        ) : closedBy ? (
          <ClockNotice
            testID="correction-closed"
            tone="muted"
            icon={LockSimpleIcon}
            title={t.entry.refusals[closedBy]}
          />
        ) : null}
        {pastDay ? (
          <View
            testID="correction-past-day"
            className="flex-row gap-2.5 rounded-[16px] bg-review-soft p-3.5"
          >
            <View className="pt-0.5">
              <Icon icon={PencilSimpleLineIcon} tone="review" size={16} weight="bold" />
            </View>
            <Text className="flex-1 text-[13.5px] leading-[19px] text-foreground">
              {t.correction.pastDayNotice}
            </Text>
          </View>
        ) : null}
        {body}
      </ScrollView>
    </View>
  );
}

function ownDayText(
  businessDate: string,
  today: string,
  window: SelfServiceWindow | undefined,
  t: Dictionary,
  locale: string
): string {
  const until = window ? correctableUntil(businessDate, window.days) : null;
  if (until === null || until < today) return t.correction.ownDay;
  if (until === today) return t.correction.ownDayUntilMidnight;
  return t.correction.ownDayUntil(formatBusinessDay(until, locale));
}

function SessionForm({
  session,
  held,
  timezone,
  today,
  window,
  viewerId,
  errors,
  saving,
  closed,
  onChange,
  onOpenClock,
  onDelete,
}: {
  session: AttendanceSession;
  held: HeldDraft;
  timezone: string | null;
  today: string;
  window: SelfServiceWindow | undefined;
  viewerId: string | null;
  errors: CorrectionErrors;
  saving: boolean;
  closed: boolean;
  onChange: (update: (draft: HeldDraft) => HeldDraft) => void;
  onOpenClock: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useTranslation();
  const events = useSessionEvents(session.id);
  const entered = session.origin === "ENTERED";
  const running = session.endedAt === null;
  const savedStart = timeFieldOf(session.startedAt, timezone);
  const savedEnd = timeFieldOf(session.endedAt, timezone);
  const enteredBy = enteredByName(events.data ?? []);
  const deletability = sessionDeletable({ session, today, viewerId });

  const openAt = (target: TimeField) => () =>
    defaultTime(
      {
        businessDate: session.businessDate,
        startedAt: held.startedAt,
        endedAt: held.endedAt,
        nextDay: held.endedAt !== "" && held.endedAt < held.startedAt,
        breaks: liveDraft(held).breaks,
      },
      target,
      { now: new Date(), timezone, today }
    );

  const endHint = (() => {
    if (running) return null;
    const moved = held.endedAt !== savedEnd;
    if (session.closedBy === "SWEEP") {
      return moved ? t.correction.wasSwept(savedEnd) : t.correction.setBySweep;
    }
    return moved ? t.correction.was(savedEnd) : null;
  })();
  const fieldError = (error: CorrectionErrors["startedAt"]) =>
    error === "END_BEFORE_START" ? t.entry.refusals.END_BEFORE_START : null;

  return (
    <>
      <View className="gap-2 px-1">
        <Text className="font-display text-[20px] font-semibold text-foreground">
          {formatBusinessDay(session.businessDate, locale)}
        </Text>
        <Text className="text-[13.5px] text-muted-foreground">
          {ownDayText(session.businessDate, today, window, t, locale)}
        </Text>
        {entered || session.changedAfterDay ? (
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            {entered ? (
              <EnteredStamp
                testID="correction-entered"
                label={enteredBy ? t.correction.enteredBy(enteredBy) : undefined}
              />
            ) : null}
            {session.changedAfterDay ? (
              <Flag
                testID="correction-changed"
                icon={PencilSimpleLineIcon}
                tone="review"
                label={t.attendance.changed}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="gap-2">
        <View className="overflow-hidden rounded-[24px] bg-card">
          <SheetRow label={entered ? t.correction.start : t.correction.clockIn}>
            <TimeCell
              testID="correction-start"
              value={held.startedAt}
              placeholder={t.entry.setStart}
              onChange={(startedAt) => onChange((draft) => ({ ...draft, startedAt }))}
              opensAt={openAt({ field: "start" })}
              disabled={saving}
            />
          </SheetRow>
          {held.startedAt !== savedStart ? (
            <Hint testID="correction-start-was" text={t.correction.was(savedStart)} />
          ) : null}
          <Separator />
          {running ? (
            <StillRunning onOpenClock={onOpenClock} />
          ) : (
            <>
              <SheetRow label={entered ? t.correction.end : t.correction.clockOut}>
                <TimeCell
                  testID="correction-end"
                  value={held.endedAt}
                  placeholder={t.entry.setEnd}
                  onChange={(endedAt) => onChange((draft) => ({ ...draft, endedAt }))}
                  opensAt={openAt({ field: "end" })}
                  disabled={saving}
                />
              </SheetRow>
              {endHint ? <Hint testID="correction-end-was" text={endHint} /> : null}
            </>
          )}
        </View>
        {[fieldError(errors.startedAt), fieldError(errors.endedAt)]
          .filter((text): text is string => text !== null)
          .map((text) => (
            <Text key={text} testID="correction-error" className="px-1 text-[13.5px] text-danger">
              {text}
            </Text>
          ))}
      </View>

      <View>
        <FieldLabel>{t.correction.breaks}</FieldLabel>
        <View className="overflow-hidden rounded-[24px] bg-card">
          {held.breaks.length === 0 && running ? (
            <Text className="px-4 py-3.5 text-[14px] text-muted-foreground">
              {t.correction.noBreaks}
            </Text>
          ) : null}
          {held.breaks.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? <Separator /> : null}
              <BreakRow
                index={index}
                entry={entry}
                message={breakMessage(entry.id, errors, held, t)}
                disabled={saving}
                onChange={(patch) => onChange((draft) => withBreakChanged(draft, entry.id, patch))}
                onRemove={() => onChange((draft) => withBreakRemoved(draft, entry.id))}
                onRestore={() => onChange((draft) => withBreakRestored(draft, entry.id))}
                startOpensAt={openAt({ field: "break-start", breakId: entry.id })}
                endOpensAt={openAt({ field: "break-end", breakId: entry.id })}
              />
            </View>
          ))}
          {running ? null : (
            <>
              {held.breaks.length > 0 ? <Separator /> : null}
              <AddRow
                testID="correction-add-break"
                label={t.correction.addBreak}
                onPress={() => onChange(withBreakAdded)}
                disabled={saving}
                className="min-h-[52px] px-4"
              />
            </>
          )}
        </View>
      </View>

      <View className="gap-2">
        {deletability.deletable ? (
          <>
            <Pressable
              testID="correction-delete"
              onPress={onDelete}
              disabled={saving || closed}
              accessibilityRole="button"
              className="min-h-[52px] flex-row items-center gap-3 rounded-[24px] bg-card px-4 active:opacity-70"
            >
              <View className="h-7 w-7 items-center justify-center rounded-full bg-danger-soft">
                <Icon icon={TrashIcon} tone="danger" size={15} weight="bold" />
              </View>
              <Text className="text-[15.5px] font-semibold text-danger">
                {t.correction.deleteSession}
              </Text>
            </Pressable>
            {deletability.entered && session.businessDate !== today ? (
              <Text className="px-1 text-[12.5px] leading-[17px] text-muted-foreground">
                {t.correction.enteredDeleteHint}
              </Text>
            ) : null}
          </>
        ) : (
          <Text
            testID="correction-keep-hint"
            className="px-1 text-[12.5px] leading-[17px] text-muted-foreground"
          >
            {deletability.hint === "ENTERED_BY_ADMIN"
              ? t.correction.enteredByAdminHint
              : t.correction.clockedEarlierHint}
          </Text>
        )}
      </View>

      <View>
        <FieldLabel>{t.correction.history}</FieldLabel>
        {events.data && events.data.length > 0 ? (
          <View testID="correction-history" className="gap-2.5 px-1">
            {events.data.map((event) => (
              <View key={event.id} className="gap-0.5">
                <Text className="text-[12px] text-faint" style={TABULAR}>
                  {historyStamp(event.createdAt, timezone, locale)}
                </Text>
                <Text className="text-[14px] leading-[19px] text-foreground">
                  {`${historyText(event, timezone, t)}. `}
                  <Text className="text-muted-foreground">
                    {event.user?.name ?? t.correction.system}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="px-1 text-[14px] text-muted-foreground">
            {events.isPending
              ? t.correction.loading
              : events.isError
                ? t.correction.historyFailed
                : t.correction.historyEmpty}
          </Text>
        )}
      </View>
    </>
  );
}

function breakMessage(
  id: string,
  errors: CorrectionErrors,
  draft: HeldDraft,
  t: Dictionary
): string | undefined {
  const error = errors.breaks?.[id];
  // An empty new break keeps Save disabled; "needs a time" would greet the reader.
  if (!error || error === "REQUIRED") return undefined;
  if (error === "BREAK_OUTSIDE_SESSION" && draft.startedAt && draft.endedAt) {
    return t.entry.errors.breakOutside(draft.startedAt, draft.endedAt);
  }
  const other = draft.breaks.find((entry) => entry.id === errors.overlaps?.[id]);
  if (error === "BREAK_OVERLAPS" && other) {
    return t.entry.errors.breakOverlaps(other.startedAt, other.endedAt);
  }
  return t.entry.refusals[error];
}

function Hint({ text, testID }: { text: string; testID: string }) {
  return (
    <Text testID={testID} className="-mt-1 px-4 pb-2.5 text-right text-[12.5px] text-faint">
      {text}
    </Text>
  );
}

function StillRunning({ onOpenClock }: { onOpenClock: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[15.5px] text-foreground">{t.correction.clockOut}</Text>
        <View testID="correction-still-running" className="flex-row items-center gap-1.5">
          <Icon icon={PlayIcon} tone="ok" size={13} weight="fill" />
          <Text className="text-[15px] font-semibold text-ok">{t.correction.stillRunning}</Text>
        </View>
      </View>
      <Text className="text-[12.5px] leading-[17px] text-muted-foreground">
        {t.correction.stillRunningHint}
      </Text>
      <Pressable
        testID="correction-open-clock"
        onPress={onOpenClock}
        accessibilityRole="link"
        className="h-9 flex-row items-center gap-1.5 self-start rounded-full bg-accent px-3.5 active:opacity-70"
      >
        <Text className="text-[14px] font-semibold text-primary">{t.correction.openClock}</Text>
        <Icon icon={ArrowUpRightIcon} tone="primary" size={14} weight="bold" />
      </Pressable>
    </View>
  );
}

function BreakRow({
  index,
  entry,
  message,
  disabled,
  onChange,
  onRemove,
  onRestore,
  startOpensAt,
  endOpensAt,
}: {
  index: number;
  entry: HeldBreak;
  message: string | undefined;
  disabled: boolean;
  onChange: (patch: { startedAt?: string; endedAt?: string }) => void;
  onRemove: () => void;
  onRestore: () => void;
  startOpensAt: () => string;
  endOpensAt: () => string;
}) {
  const { t } = useTranslation();
  const prefix = `correction-break-${index + 1}`;

  if (entry.removed) {
    return (
      <View testID={`${prefix}-removed`} className="min-h-[52px] gap-0.5 px-4 py-2.5">
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-1 text-[15.5px] text-faint"
            style={{ textDecorationLine: "line-through" }}
          >
            {t.entry.breakLabel(index + 1)}
          </Text>
          <Text
            className="text-[15px] text-faint"
            style={[TABULAR, { textDecorationLine: "line-through" }]}
          >
            {`${entry.startedAt} - ${entry.endedAt || t.correction.breakRunning}`}
          </Text>
          <Pressable
            testID={`${prefix}-undo`}
            onPress={onRestore}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            className="ml-1 h-8 flex-row items-center gap-1 rounded-full bg-accent px-3 active:opacity-70"
          >
            <Icon icon={ArrowCounterClockwiseIcon} tone="primary" size={13} weight="bold" />
            <Text className="text-[13.5px] font-semibold text-primary">{t.correction.undo}</Text>
          </Pressable>
        </View>
        <Text className="text-[12.5px] text-muted-foreground">{t.correction.removedOnSave}</Text>
      </View>
    );
  }

  return (
    <View className="gap-1.5 px-4 py-2.5">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-[15.5px] text-foreground">
          {t.entry.breakLabel(index + 1)}
        </Text>
        <TimeCell
          testID={`${prefix}-start`}
          value={entry.startedAt}
          placeholder={t.entry.setStart}
          onChange={(startedAt) => onChange({ startedAt })}
          opensAt={startOpensAt}
          disabled={disabled}
        />
        <Text className="text-[15px] text-faint">-</Text>
        {entry.running && entry.endedAt === "" ? (
          <Text testID={`${prefix}-running`} className="text-[15px] font-semibold text-ok">
            {t.correction.breakRunning}
          </Text>
        ) : (
          <TimeCell
            testID={`${prefix}-end`}
            value={entry.endedAt}
            placeholder={t.entry.setEnd}
            onChange={(endedAt) => onChange({ endedAt })}
            opensAt={endOpensAt}
            disabled={disabled}
          />
        )}
        <Pressable
          testID={`${prefix}-remove`}
          onPress={onRemove}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.correction.removeBreak}
          className="h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-70"
        >
          <Icon icon={XIcon} tone="muted" size={14} weight="bold" />
        </Pressable>
      </View>
      {message ? <Text className="text-[13px] text-danger">{message}</Text> : null}
    </View>
  );
}
