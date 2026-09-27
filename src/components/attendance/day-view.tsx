import type { Href } from "expo-router";
import { ArrowClockwiseIcon, CalendarPlusIcon, WarningCircleIcon } from "phosphor-react-native";
import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { ClockNotice, NoticeAction } from "@/components/clock/clock-notice";
import { ClockWidget } from "@/components/clock/clock-widget";
import { DayTotals } from "@/components/clock/day-totals";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  anySessionLocated,
  dayTotals,
  endOfBusinessDay,
  entryOffered,
  timelineStrip,
  useDayRead,
  useMonthRead,
  windowNote,
  type AttendanceSession,
  type AttendanceState,
} from "@/lib/attendance";
import { useNow } from "@/lib/use-now";

import { AddRow } from "./add-row";
import { DayFigures } from "./day-figures";
import { SessionGroup } from "./session-group";
import { TimelineStrip } from "./timeline-strip";
import { WindowNote } from "./window-note";

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

  const reader = {
    window: state.selfService,
    today,
    active: state.active,
    employmentEnded: state.employmentEnded,
  };
  // Which days take an entry is the month's to say: it knows the Employment's spell.
  const monthDay = month.data?.days.find((entry) => entry.businessDate === date);
  const onAddSession =
    reader.window && monthDay && entryOffered({ ...reader, window: reader.window, day: monthDay })
      ? () => onNavigate({ pathname: "/my-attendance/entry", params: { date } })
      : undefined;
  const note = windowNote({ ...reader, businessDate: date });

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
            onAddSession={onAddSession}
          />
        ) : day.isError ? (
          <DayReadFailed onRetry={() => void day.refetch()} />
        ) : (
          <SessionsSkeleton />
        )}
        <DayFigures month={month.data} date={date} loading={month.isPending} />
        {sessions?.length && onAddSession ? <AddSessionRow onPress={onAddSession} /> : null}
      </View>

      {note ? <WindowNote note={note} /> : null}
    </View>
  );
}

function DaySessions({
  sessions,
  date,
  today,
  timezone,
  showLocation,
  onAddSession,
}: {
  sessions: AttendanceSession[];
  date: string;
  today: string;
  timezone: string | null;
  showLocation: boolean;
  onAddSession: (() => void) | undefined;
}) {
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
        <EmptyDay live={live} onAddSession={onAddSession} />
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

function EmptyDay({ live, onAddSession }: { live: boolean; onAddSession?: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-start gap-3 py-1">
      <Text className="text-[14px] text-muted-foreground">
        {live ? t.attendance.emptyToday : t.attendance.emptyPastDay}
      </Text>
      {onAddSession && !live ? (
        <Text className="text-[14px] leading-5 text-foreground">
          {t.selfService.emptyPastDayPrompt}
        </Text>
      ) : null}
      {onAddSession ? (
        <Pressable
          testID="empty-day-add"
          onPress={onAddSession}
          accessibilityRole="button"
          className={
            live
              ? "h-10 flex-row items-center gap-2 rounded-full border border-input bg-card px-4 active:opacity-80"
              : "h-10 flex-row items-center gap-2 rounded-full bg-primary px-4 active:opacity-90"
          }
        >
          <Icon
            icon={CalendarPlusIcon}
            tone={live ? "foreground" : "onPrimary"}
            size={16}
            weight="bold"
          />
          <Text
            className={
              live
                ? "text-[14px] font-semibold text-foreground"
                : "text-[14px] font-semibold text-primary-foreground"
            }
          >
            {t.selfService.addSession}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AddSessionRow({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <View className="h-px bg-border" />
      <AddRow testID="add-session-row" label={t.selfService.addSession} onPress={onPress} />
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
