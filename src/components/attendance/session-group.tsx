import { ClockCounterClockwiseIcon, PencilSimpleLineIcon, PlayIcon } from "phosphor-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  formatClockTime,
  formatMinutes,
  locationText,
  sessionMarks,
  sessionRows,
  type AttendanceSession,
  type SessionEnd,
  type SessionMark,
} from "@/lib/attendance";
import { cn } from "@/lib/cn";

import { EnteredStamp, Flag } from "./chips";

function Mark({ mark }: { mark: SessionMark }) {
  const { t } = useTranslation();
  switch (mark.kind) {
    case "entered":
      return <EnteredStamp testID="mark-entered" />;
    case "changed":
      return (
        <Flag
          testID="mark-changed"
          icon={PencilSimpleLineIcon}
          tone="review"
          label={t.attendance.changed}
        />
      );
    case "auto-closed":
      return (
        <Flag
          testID="mark-auto-closed"
          icon={ClockCounterClockwiseIcon}
          tone="warm"
          label={t.attendance.autoClosed}
        />
      );
    case "still-open":
      return (
        <Flag
          testID="mark-still-open"
          icon={PlayIcon}
          tone={mark.overdue ? "warm" : "ok"}
          label={t.attendance.stillOpen}
        />
      );
  }
}

function Rows({ session, now, live }: { session: AttendanceSession; now: number; live: boolean }) {
  const { t } = useTranslation();
  const time = (iso: string) => formatClockTime(iso, session.timezone);
  const openEnd = live ? t.attendance.now : t.attendance.stillOpen;
  return (
    <View>
      {sessionRows(session, now).map((row) => (
        <View
          key={`${row.kind}-${row.startedAt}`}
          testID={`row-${row.kind}`}
          className="min-h-10 flex-row items-center gap-3 py-1.5"
        >
          <View
            className={cn("h-2.5 w-2.5 rounded-full", row.kind === "work" ? "bg-ok" : "bg-warm")}
          />
          <Text className="w-14 text-[14px] font-semibold text-foreground">
            {row.kind === "work" ? t.attendance.work : t.attendance.breakSegment}
          </Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-[14px] text-muted-foreground" style={TABULAR}>
              {`${time(row.startedAt)} - ${row.endedAt ? time(row.endedAt) : openEnd}`}
            </Text>
            {row.autoClosed ? (
              <Flag
                testID="row-auto-closed"
                icon={ClockCounterClockwiseIcon}
                tone="warm"
                label={t.attendance.autoClosed}
              />
            ) : null}
          </View>
          <Text className="text-[14px] font-semibold text-foreground" style={TABULAR}>
            {formatMinutes(row.minutes)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LocationCell({ session, end }: { session: AttendanceSession; end: SessionEnd }) {
  const { t } = useTranslation();
  const { coordinates, accuracy } = locationText(session, end);
  const text = coordinates
    ? accuracy !== null
      ? `${coordinates} ${t.attendance.locationAccuracy(accuracy)}`
      : coordinates
    : t.attendance.locationMissing;
  return (
    <View className="flex-1 gap-0.5">
      <Text className="text-[11px] font-bold tracking-[0.6px] text-faint uppercase">
        {end === "IN" ? t.attendance.locationIn : t.attendance.locationOut}
      </Text>
      <Text
        testID={`location-${end.toLowerCase()}`}
        className="text-[13px] text-muted-foreground"
        style={TABULAR}
      >
        {text}
      </Text>
    </View>
  );
}

export function SessionGroup({
  session,
  today,
  now,
  showLocation,
}: {
  session: AttendanceSession;
  today: string;
  now: number;
  showLocation: boolean;
}) {
  const { t } = useTranslation();
  const marks = sessionMarks(session, today);
  return (
    <View className="gap-1" testID="session-group">
      {marks.length ? (
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5 pb-1">
          {marks.map((mark) => (
            <Mark key={mark.kind} mark={mark} />
          ))}
        </View>
      ) : null}
      <Rows session={session} now={now} live={session.businessDate === today} />
      {showLocation ? (
        <View testID="session-location" className="flex-row gap-3 border-t border-border pt-2.5">
          <LocationCell session={session} end="IN" />
          <LocationCell session={session} end="OUT" />
        </View>
      ) : null}
      {session.changedAfterDay ? (
        <View
          testID="changed-notice"
          className="mt-2 flex-row gap-2.5 rounded-[16px] bg-review-soft p-3"
        >
          <View className="pt-0.5">
            <Icon icon={PencilSimpleLineIcon} tone="review" size={16} weight="bold" />
          </View>
          <Text className="flex-1 text-[13.5px] leading-[19px] text-foreground">
            {t.attendance.changedNotice}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
