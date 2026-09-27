import { Pressable, View } from "react-native";

import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dayParts } from "@/lib/calendar/day";
import { buildWeeks, type CalendarRange } from "@/lib/calendar/lanes";
import { placeStripeWeek } from "@/lib/calendar/stripes";
import { cn } from "@/lib/cn";
import { isoDay, type YearMonth } from "@/lib/requests/months";

const CALENDAR_GUTTER = 16;
const HEADER_H = 26;
const DAY_H = 28;
const STRIPES_TOP = 34;
const STRIPE_H = 4;
const STRIPE_GAP = 2;
const ROW_H = STRIPES_TOP + 3 * (STRIPE_H + STRIPE_GAP) + 16;

export function stripeMonthHeight(weeks: number): number {
  return HEADER_H + weeks * ROW_H;
}

export function StripeMonth({
  month,
  ranges,
  width,
  viewerId,
  today,
  selected,
  onDay,
}: {
  month: YearMonth;
  ranges: readonly CalendarRange[];
  width: number;
  viewerId: string | null;
  today: string;
  selected: string;
  onDay: (day: string) => void;
}) {
  const { t } = useTranslation();
  const cellWidth = (width - CALENDAR_GUTTER * 2) / 7;
  const weeks = buildWeeks(month);

  const dayLabel = (iso: string, day: number) => {
    const { weekday, date } = dayParts(iso);
    const away = new Set(
      ranges
        .filter((range) => range.type !== "BANK_HOLIDAY" && range.from <= day && range.to >= day)
        .map((range) => range.userId)
    ).size;
    const holidays = ranges
      .filter((range) => range.type === "BANK_HOLIDAY" && range.from <= day && range.to >= day)
      .flatMap((range) => range.names);
    return [
      iso === today ? t.calendar.today : null,
      t.calendar.dayTitle(weekday, date),
      ...holidays,
      away > 0 ? t.dashboard.calendar.awayCount(away) : null,
    ]
      .filter(Boolean)
      .join(", ");
  };

  return (
    <View
      testID={`calendar-month-${isoDay(month, 1).slice(0, 7)}`}
      style={{ width, paddingHorizontal: CALENDAR_GUTTER }}
    >
      <View className="flex-row" style={{ height: HEADER_H }}>
        {t.calendar.weekdaysShort.map((weekday, index) => (
          <View key={weekday} style={{ width: cellWidth }} className="items-center justify-center">
            <Text
              className={cn(
                "text-[11px] font-semibold uppercase",
                index >= 5 ? "text-faint" : "text-muted-foreground"
              )}
              style={{ letterSpacing: 0.4 }}
            >
              {weekday}
            </Text>
          </View>
        ))}
      </View>
      {weeks.map((week) => {
        const { stripes, more, holidays } = placeStripeWeek(week, ranges, { viewerId });
        return (
          <View
            key={week.find((day) => day !== null)}
            style={{ height: ROW_H }}
            className="flex-row border-t border-border"
          >
            {week.map((day, column) => {
              if (day === null) {
                // Seven fixed columns that never reorder: the column is the cell.
                // eslint-disable-next-line @eslint-react/no-array-index-key
                return <View key={column} style={{ width: cellWidth }} />;
              }
              const iso = isoDay(month, day);
              const isToday = iso === today;
              const isSelected = iso === selected;
              const holiday = holidays.has(column);
              return (
                <Pressable
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={column}
                  testID={`calendar-day-${iso}`}
                  onPress={() => onDay(iso)}
                  accessibilityRole="button"
                  accessibilityLabel={dayLabel(iso, day)}
                  accessibilityState={{ selected: isSelected }}
                  style={{ width: cellWidth }}
                  className="items-center pt-1"
                >
                  {holiday ? (
                    <View
                      testID={`calendar-holiday-${iso}`}
                      className="absolute inset-x-[3px] top-[3px] bottom-[3px] overflow-hidden rounded-[12px]"
                    >
                      <View className="absolute inset-0 bg-leave-bank" style={{ opacity: 0.18 }} />
                    </View>
                  ) : null}
                  <View
                    style={{ height: DAY_H, width: DAY_H }}
                    className={cn(
                      "items-center justify-center rounded-full",
                      isSelected && (isToday ? "bg-primary" : "bg-foreground")
                    )}
                  >
                    <Text
                      className={cn(
                        "text-[14px]",
                        isSelected
                          ? isToday
                            ? "font-bold text-primary-foreground"
                            : "font-bold text-background"
                          : isToday
                            ? "font-bold text-primary"
                            : holiday
                              ? "font-semibold text-leave-bank"
                              : column >= 5
                                ? "text-faint"
                                : "font-medium text-foreground"
                      )}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {stripes.map((placed) => {
              const inset = 5;
              const left = placed.startColumn * cellWidth + (placed.continuesLeft ? 0 : inset);
              const stripeWidth =
                (placed.endColumn - placed.startColumn) * cellWidth -
                (placed.continuesLeft ? 0 : inset) -
                (placed.continuesRight ? 0 : inset);
              return (
                <View
                  key={placed.range.id}
                  testID={`calendar-stripe-${placed.range.vacationIds[0]}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left,
                    width: stripeWidth,
                    top: STRIPES_TOP + placed.lane * (STRIPE_H + STRIPE_GAP),
                    height: STRIPE_H,
                    borderRadius: STRIPE_H / 2,
                    opacity: placed.faded ? 0.4 : 1,
                  }}
                  className={LEAVE_CLASSES[placed.range.type].fill}
                />
              );
            })}
            {[...more].map(([column, count]) => (
              <View
                key={column}
                testID={`calendar-more-${isoDay(month, week[column]!)}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: column * cellWidth,
                  width: cellWidth,
                  bottom: 2,
                }}
                className="items-center"
              >
                <Text className="text-[10px] font-semibold text-faint">
                  {t.dashboard.calendar.more(count)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
