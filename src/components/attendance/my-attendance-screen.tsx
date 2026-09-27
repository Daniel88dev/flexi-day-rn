import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, type Href } from "expo-router";
import { ArrowClockwiseIcon, WarningCircleIcon, WifiSlashIcon } from "phosphor-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { ClockNotice, NoticeAction } from "@/components/clock/clock-notice";
import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  linkedDay,
  refreshDayView,
  useClockRead,
  type ClockView,
  type DayViewReads,
} from "@/lib/attendance";
import { currentMonth, isoDay } from "@/lib/requests/months";
import { useToday } from "@/lib/use-today";

import { DayStepper, ViewPill, type AttendanceView } from "./day-header";
import { DayView } from "./day-view";

const BUILT_VIEWS: AttendanceView[] = ["day"];

/** The organization's day once the clock has named it; the phone's own date until then. */
function useAttendanceToday(view: ClockView): string {
  const device = useToday();
  if (view.kind === "ready" && view.state.businessDate) return view.state.businessDate;
  return isoDay(currentMonth(device), device.getDate());
}

const navigate = (href: Href) => router.navigate(href);

/**
 * The Day view with its stepper, over the clock's read. `anchored` stays as it was set and is
 * judged against today on every render, so a link or a step made before the organization's day
 * was known still lands right, and null follows today across midnight.
 */
function AttendanceDay({
  anchored,
  onAnchor,
  header,
}: {
  anchored: string | null;
  onAnchor: (date: string | null) => void;
  header?: (ready: boolean) => ReactNode;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const primary = useTone("primary");
  const { view, reread } = useClockRead();
  const today = useAttendanceToday(view);
  const date = linkedDay(anchored, today);
  const [refreshing, setRefreshing] = useState(false);

  const reads: DayViewReads = {
    organizationId: view.kind === "ready" ? view.state.organizationId : null,
    date,
    today,
  };
  const readsRef = useRef(reads);
  useEffect(() => {
    readsRef.current = reads;
  });

  const refresh = () => {
    setRefreshing(true);
    void refreshDayView(queryClient, reads).finally(() => setRefreshing(false));
  };

  // A tab stays mounted, so coming back to it reads again the way opening it did.
  const focusedBeforeRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBeforeRef.current) void refreshDayView(queryClient, readsRef.current);
      focusedBeforeRef.current = true;
    }, [queryClient])
  );

  const ready = view.kind === "ready";
  return (
    <ScrollView
      testID="my-attendance"
      className="flex-1"
      contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
      }
    >
      {header?.(ready)}
      {view.kind === "ready" ? (
        <>
          <DayStepper date={date} today={today} onChange={onAnchor} />
          <DayView date={date} today={today} state={view.state} onNavigate={navigate} />
        </>
      ) : view.kind === "no-employment" ? (
        <Text testID="attendance-not-set-up" className="py-16 text-center text-[15px] text-faint">
          {t.attendance.notSetUp}
        </Text>
      ) : view.kind === "loading" ? (
        <View className="gap-4" testID="attendance-loading">
          <View className="h-9 w-56 rounded-full bg-muted" />
          <View className="h-64 rounded-[24px] bg-card" />
        </View>
      ) : (
        <ClockNotice
          testID={view.kind === "unreachable" ? "attendance-offline" : "attendance-read-failed"}
          tone={view.kind === "unreachable" ? "muted" : "danger"}
          icon={view.kind === "unreachable" ? WifiSlashIcon : WarningCircleIcon}
          title={view.kind === "unreachable" ? t.clock.unreachable : t.clock.serverError}
          body={view.kind === "unreachable" ? undefined : t.clock.serverErrorBody}
        >
          <NoticeAction label={t.clock.tryAgain} icon={ArrowClockwiseIcon} onPress={reread} />
        </ClockNotice>
      )}
    </ScrollView>
  );
}

/**
 * My attendance, on Day. A `?date=` link re-anchors it on that day, and is then taken off the
 * route so the same link followed again still lands.
 */
export function MyAttendanceScreen({
  linkedDate,
  onLinkConsumed,
}: {
  linkedDate: string | null;
  onLinkConsumed: () => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<AttendanceView>("day");
  const [anchored, setAnchored] = useState<string | null>(linkedDate);

  const [seenLink, setSeenLink] = useState(linkedDate);
  if (linkedDate !== seenLink) {
    setSeenLink(linkedDate);
    if (linkedDate !== null) {
      setView("day");
      setAnchored(linkedDate);
    }
  }
  useEffect(() => {
    if (linkedDate !== null) onLinkConsumed();
  }, [linkedDate, onLinkConsumed]);

  return (
    <View className="flex-1 bg-background pt-safe">
      <AttendanceDay
        anchored={anchored}
        onAnchor={setAnchored}
        header={(ready) => (
          <View className="gap-3">
            <Text
              className="font-display text-[28px] font-semibold text-foreground"
              style={{ letterSpacing: -0.56 }}
            >
              {t.attendance.title}
            </Text>
            {ready ? (
              <ViewPill
                value={view}
                available={BUILT_VIEWS}
                onChange={(next) => {
                  setView(next);
                  setAnchored(null);
                }}
              />
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

export function PushedDay({ date }: { date: string }) {
  const [anchored, setAnchored] = useState<string | null>(date);
  return <AttendanceDay anchored={anchored} onAnchor={setAnchored} />;
}
