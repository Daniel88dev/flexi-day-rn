import {
  CalendarXIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  PencilSimpleLineIcon,
  PlayIcon,
} from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  dayRow,
  formatRowDay,
  type AttendanceBalanceMode,
  type AttendanceMonthDay,
  type RowChip,
} from "@/lib/attendance";
import { cn } from "@/lib/cn";

import { BalanceChip, EnteredStamp, Flag, Hatch, TagChip } from "./chips";

function Chip({ chip }: { chip: RowChip }) {
  const { t } = useTranslation();
  switch (chip.kind) {
    case "balance":
      return <BalanceChip testID="chip-balance" minutes={chip.minutes} />;
    case "auto-closed":
      return (
        <Flag
          testID="chip-auto-closed"
          icon={ClockCounterClockwiseIcon}
          tone="warm"
          label={t.attendance.autoClosed}
        />
      );
    case "excluded-day":
      return (
        <Flag
          testID="chip-excluded-day"
          icon={CalendarXIcon}
          tone="warm"
          label={t.attendance.excludedDay}
        />
      );
    case "changed":
      return (
        <Flag
          testID="chip-changed"
          icon={PencilSimpleLineIcon}
          tone="review"
          label={t.attendance.changedLater}
        />
      );
    case "still-open":
      return (
        <Flag
          testID="chip-still-open"
          icon={PlayIcon}
          tone={chip.overdue ? "warm" : "ok"}
          label={t.attendance.stillOpen}
        />
      );
    case "entered":
      return <EnteredStamp testID="chip-entered" />;
    case "tag":
      return <TagChip testID="chip-tag" label={chip.label} />;
  }
}

/**
 * One day of the Week or the Month. A day that has begun opens onto its Day screen; one still to
 * come has nothing to open.
 */
export function DayRow({
  day,
  mode,
  today,
  onOpen,
}: {
  day: AttendanceMonthDay;
  mode: AttendanceBalanceMode;
  today: string;
  onOpen: (date: string) => void;
}) {
  const { t, locale } = useTranslation();
  const row = dayRow(day, mode, today, t);
  const label = formatRowDay(day.businessDate, locale);
  const tappable = !day.upcoming;
  const isToday = day.businessDate === today;

  const content = (
    <>
      {row.hatched ? <Hatch /> : null}
      <View className="w-12 gap-0.5 pt-0.5">
        <Text
          className={cn(
            "text-[15px] font-semibold",
            row.toCome ? "text-faint" : isToday ? "text-primary" : "text-foreground"
          )}
        >
          {label.weekday}
        </Text>
        <Text className="text-[12.5px] text-muted-foreground" style={TABULAR}>
          {label.date}
        </Text>
      </View>
      {row.toCome ? (
        <Text className="flex-1 self-center text-[14px] text-faint">{t.attendance.toCome}</Text>
      ) : (
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-baseline gap-x-1.5">
            {row.worked !== null ? (
              <Text className="text-[17px] font-semibold text-foreground" style={TABULAR}>
                {row.worked}
              </Text>
            ) : null}
            <Text
              className={cn(
                row.worked === null
                  ? "text-[14.5px] font-semibold text-muted-foreground"
                  : "text-[13.5px] text-muted-foreground"
              )}
              style={TABULAR}
            >
              {row.detail}
            </Text>
          </View>
          {row.present ? (
            <Text className="text-[12.5px] text-muted-foreground" style={TABULAR}>
              {row.present}
            </Text>
          ) : null}
          {row.chips.length ? (
            <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1">
              {row.chips.map((chip) => (
                <Chip key={chip.kind} chip={chip} />
              ))}
            </View>
          ) : null}
        </View>
      )}
      {tappable ? (
        <View className="self-center">
          <Icon icon={CaretRightIcon} tone="faint" size={16} weight="bold" />
        </View>
      ) : null}
    </>
  );

  const className = cn(
    "min-h-[60px] flex-row gap-3 overflow-hidden rounded-[16px] border bg-card px-3.5 py-3",
    isToday ? "border-primary" : "border-border",
    row.toCome && "border-input bg-transparent"
  );
  const style = row.toCome ? { borderStyle: "dashed" as const } : undefined;

  if (!tappable) {
    return (
      <View testID={`day-row-${day.businessDate}`} className={className} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={`day-row-${day.businessDate}`}
      accessibilityRole="button"
      onPress={() => onOpen(day.businessDate)}
      className={cn(className, "active:opacity-70")}
    >
      {content}
    </Pressable>
  );
}
