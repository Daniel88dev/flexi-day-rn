// PROTOTYPE (T-265): the stripes month with adjacent-month days, in three variants. Throwaway.
import { Pressable, View } from "react-native";

import {
  PROTO_ADJACENT_NUMBER_OPACITY,
  PROTO_FADE,
  ProtoHatch,
} from "@/components/calendar/prototype-adjacent-lane-month";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  paddedWeeks,
  protoPlaceWeek,
  seamColumn,
  seamLabel,
  splitAtBoundary,
  type ProtoRange,
  type ProtoVariant,
} from "@/lib/calendar/prototype-adjacent";
import { cn } from "@/lib/cn";
import { isoDay, type YearMonth } from "@/lib/requests/months";

const CALENDAR_GUTTER = 16;
const HEADER_H = 26;
const DAY_H = 28;
const STRIPES_TOP = 34;
const STRIPE_H = 4;
const STRIPE_GAP = 2;
const MAX_STRIPES = 3;

export function ProtoStripeMonth({
  month,
  ranges,
  width,
  viewerId,
  today,
  selected,
  variant,
  syncedFrom,
  onDay,
}: {
  month: YearMonth;
  ranges: readonly ProtoRange[];
  width: number;
  viewerId: string | null;
  today: string;
  selected: string;
  variant: ProtoVariant;
  syncedFrom: string;
  onDay: (day: string) => void;
}) {
  const { t } = useTranslation();
  const cellWidth = (width - CALENDAR_GUTTER * 2) / 7;
  const weeks = paddedWeeks(month, syncedFrom);
  const ROW_H = STRIPES_TOP + MAX_STRIPES * (STRIPE_H + STRIPE_GAP) + 16;

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
      {weeks.map((week, weekIndex) => {
        const people = ranges.filter((range) => range.type !== "BANK_HOLIDAY");
        const { shown, hidden } = protoPlaceWeek(week, people, {
          maxLanes: MAX_STRIPES,
          viewerId,
        });
        const holidays = new Set<number>();
        for (const range of ranges) {
          if (range.type !== "BANK_HOLIDAY") continue;
          week.forEach((cell, column) => {
            if (cell.iso >= range.from && cell.iso <= range.to) holidays.add(column);
          });
        }
        const seam = variant === "C" ? seamColumn(week) : null;
        const stripes = shown.flatMap((bar) =>
          variant === "B"
            ? splitAtBoundary(bar, week).map((segment) => ({
                ...segment,
                fade: segment.outside ? PROTO_FADE : 1,
              }))
            : [{ ...bar, fade: 1 }]
        );
        return (
          <View
            key={week[0].iso}
            style={{ height: ROW_H }}
            className="flex-row border-t border-border"
          >
            {week.map((cell, column) => {
              const adjacent = !cell.inMonth;
              const blank = adjacent && cell.unsynced && variant === "B";
              const unknown = adjacent && cell.unsynced && variant === "C";
              const isToday = cell.iso === today;
              const isSelected = cell.iso === selected;
              const holiday = holidays.has(column);
              const label = variant === "C" ? seamLabel(week, column, weekIndex) : null;
              if (blank) {
                // eslint-disable-next-line @eslint-react/no-array-index-key
                return <View key={column} style={{ width: cellWidth }} />;
              }
              return (
                <Pressable
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={column}
                  testID={`calendar-day-${cell.iso}`}
                  disabled={unknown}
                  onPress={() => onDay(cell.iso)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={{ width: cellWidth }}
                  className="items-center pt-1"
                >
                  {adjacent && variant === "A" ? (
                    <View className="absolute inset-x-[2px] top-[2px] bottom-[2px] rounded-[10px] bg-tint" />
                  ) : null}
                  {unknown ? <ProtoHatch /> : null}
                  {holiday ? (
                    <View
                      className="absolute inset-x-[3px] top-[3px] bottom-[3px] overflow-hidden rounded-[12px]"
                      style={{ opacity: adjacent && variant === "B" ? PROTO_FADE : 1 }}
                    >
                      <View className="absolute inset-0 bg-leave-bank" style={{ opacity: 0.18 }} />
                    </View>
                  ) : null}
                  {label ? (
                    <Text
                      className="absolute top-0 left-[2px] text-[8.5px] font-bold text-muted-foreground uppercase"
                      style={{ letterSpacing: 0.2 }}
                    >
                      {label}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      height: DAY_H,
                      width: DAY_H,
                      opacity: adjacent && !isSelected ? PROTO_ADJACENT_NUMBER_OPACITY : 1,
                    }}
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
                            : adjacent
                              ? "text-faint"
                              : holiday
                                ? "font-semibold text-leave-bank"
                                : column >= 5
                                  ? "text-faint"
                                  : "font-medium text-foreground"
                      )}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {seam !== null ? (
              <View
                pointerEvents="none"
                className="absolute bg-input"
                style={{ left: seam * cellWidth - 0.75, width: 1.5, top: 0, bottom: 0 }}
              />
            ) : null}
            {stripes.map((placed) => {
              const inset = 5;
              const left = placed.startColumn * cellWidth + (placed.continuesLeft ? 0 : inset);
              const stripeWidth =
                (placed.endColumn - placed.startColumn) * cellWidth -
                (placed.continuesLeft ? 0 : inset) -
                (placed.continuesRight ? 0 : inset);
              const pendingFade =
                placed.range.status === "pending" || placed.range.pending ? 0.4 : 1;
              return (
                <View
                  key={`${placed.range.id}|${placed.startColumn}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left,
                    width: stripeWidth,
                    top: STRIPES_TOP + placed.lane * (STRIPE_H + STRIPE_GAP),
                    height: STRIPE_H,
                    borderTopLeftRadius: placed.continuesLeft ? 0 : STRIPE_H / 2,
                    borderBottomLeftRadius: placed.continuesLeft ? 0 : STRIPE_H / 2,
                    borderTopRightRadius: placed.continuesRight ? 0 : STRIPE_H / 2,
                    borderBottomRightRadius: placed.continuesRight ? 0 : STRIPE_H / 2,
                    opacity: pendingFade * placed.fade,
                  }}
                  className={LEAVE_CLASSES[placed.range.type].fill}
                />
              );
            })}
            {[...hidden].map(([column, list]) => (
              <View
                key={column}
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
                  {t.dashboard.calendar.more(list.length)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
