import type { Href } from "expo-router";
import { ArrowClockwiseIcon, WarningCircleIcon } from "phosphor-react-native";
import { Fragment } from "react";
import { View } from "react-native";

import { ClockNotice, NoticeAction } from "@/components/clock/clock-notice";
import { ClockWidget } from "@/components/clock/clock-widget";
import { DayTotals } from "@/components/clock/day-totals";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  anySessionLocated,
  dayTotals,
  endOfBusinessDay,
  timelineStrip,
  useDayRead,
  useMonthRead,
  type AttendanceSession,
  type AttendanceState,
} from "@/lib/attendance";
import { useNow } from "@/lib/use-now";

import { DayFigures } from "./day-figures";
import { SessionGroup } from "./session-group";
import { TimelineStrip } from "./timeline-strip";

export function DayView({
  date,
  today,
  state,
  onNavigate,
}: {
  date: string;
  today: string;
  state: AttendanceState;
  onNavigate: (href: Href) => void;
}) {
  const isToday = date === today;
  const day = useDayRead(state.organizationId, date, !isToday);
  const month = useMonthRead(state.organizationId, date);

  const sessions = isToday ? state.sessions : day.data?.sessions;
  const timezone = (isToday ? state.timezone : day.data?.timezone) ?? state.timezone;

  return (
    <View className="gap-4">
      {isToday ? (
        <View className="rounded-[24px] bg-card p-5" testID="attendance-clock-card">
          <ClockWidget showAttendanceLink={false} onNavigate={onNavigate} />
        </View>
      ) : null}

      <View className="gap-4 rounded-[24px] bg-card p-4" testID="attendance-day-card">
        {sessions ? (
          <DaySessions
            sessions={sessions}
            date={date}
            today={today}
            timezone={timezone}
            showLocation={state.locationEnabled || anySessionLocated(sessions)}
          />
        ) : day.isError ? (
          <DayReadFailed onRetry={() => void day.refetch()} />
        ) : (
          <SessionsSkeleton />
        )}
        <DayFigures month={month.data} date={date} loading={month.isPending} />
      </View>
    </View>
  );
}

function DaySessions({
  sessions,
  date,
  today,
  timezone,
  showLocation,
}: {
  sessions: AttendanceSession[];
  date: string;
  today: string;
  timezone: string | null;
  showLocation: boolean;
}) {
  const { t } = useTranslation();
  const live = date === today;
  // Minutes are all the rows and totals show, so a quarter of a minute keeps them current.
  const now = useNow(15_000);
  // A session left open on a day that has passed counts to that day's end, as the strip draws it.
  const until = live ? now : Math.min(now, endOfBusinessDay(date, timezone));
  const strip = timelineStrip({ sessions, businessDate: date, timezone, now, live });

  return (
    <>
      {strip ? (
        <TimelineStrip strip={strip} />
      ) : (
        <Text className="py-2 text-[14px] text-muted-foreground">
          {live ? t.attendance.emptyToday : t.attendance.emptyPastDay}
        </Text>
      )}
      {sessions.map((session, index) => (
        <Fragment key={session.id}>
          {index > 0 ? <View className="h-px bg-border" /> : null}
          <SessionGroup session={session} today={today} now={until} showLocation={showLocation} />
        </Fragment>
      ))}
      {sessions.length ? <DayTotals totals={dayTotals(sessions, until)} /> : null}
    </>
  );
}

function DayReadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <ClockNotice
      testID="attendance-day-failed"
      tone="danger"
      icon={WarningCircleIcon}
      title={t.attendance.rangeFailed}
    >
      <NoticeAction label={t.request.retry} icon={ArrowClockwiseIcon} onPress={onRetry} />
    </ClockNotice>
  );
}

function SessionsSkeleton() {
  return (
    <View className="gap-3" testID="attendance-day-loading">
      <View className="h-7 rounded-[12px] bg-muted" />
      <View className="h-4 w-2/3 rounded-full bg-muted" />
      <View className="h-4 w-1/2 rounded-full bg-muted" />
    </View>
  );
}
