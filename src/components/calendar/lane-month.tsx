import { Pressable, View } from "react-native";

import { PersonAvatar } from "@/components/calendar/person-avatar";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dayParts } from "@/lib/calendar/day";
import { buildWeeks, placeWeek, type CalendarRange, type PlacedBar } from "@/lib/calendar/lanes";
import { cn } from "@/lib/cn";
import { isoDay, type YearMonth } from "@/lib/requests/months";
import { firstName } from "@/lib/viewer/viewer";

const MAX_LANES = 2;
const CALENDAR_GUTTER = 16;

const BAR_H = 18;
const LANE_GAP = 2;
const BARS_TOP = 28;
const HEADER_H = 30;
const ROW_H = BARS_TOP + MAX_LANES * (BAR_H + LANE_GAP) + 20;
const AVATAR_MIN_WIDTH = 80;

export function laneMonthHeight(weeks: number): number {
  return HEADER_H + weeks * ROW_H + 2;
}

type LaneMonthProps = {
  month: YearMonth;
  ranges: readonly CalendarRange[];
  width: number;
  viewerId: string | null;
  today: string;
  onDay: (day: string) => void;
  onBar?: (vacationId: string) => void;
  onMore: (day: string) => void;
};

function Tint({ className, opacity }: { className: string; opacity: number }) {
  return <View className={cn("absolute inset-0", className)} style={{ opacity }} />;
}

function LaneBar({
  bar,
  cellWidth,
  top,
  label,
  onBar,
}: {
  bar: PlacedBar;
  cellWidth: number;
  top: number;
  label: string;
  onBar?: (vacationId: string) => void;
}) {
  const { range } = bar;
  const classes = LEAVE_CLASSES[range.type];
  const pending = range.status === "pending";
  const left = bar.startColumn * cellWidth + (bar.continuesLeft ? 0 : 2);
  const width =
    (bar.endColumn - bar.startColumn) * cellWidth -
    (bar.continuesLeft ? 0 : 2) -
    (bar.continuesRight ? 0 : 2);
  const leftRadius = bar.continuesLeft ? 0 : 6;
  const rightRadius = bar.continuesRight ? 0 : 6;

  return (
    <Pressable
      testID={`calendar-bar-${range.vacationIds[0]}`}
      onPress={onBar ? () => onBar(range.vacationIds[0]) : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        position: "absolute",
        left,
        width,
        top,
        height: BAR_H,
        borderTopLeftRadius: leftRadius,
        borderBottomLeftRadius: leftRadius,
        borderTopRightRadius: rightRadius,
        borderBottomRightRadius: rightRadius,
        borderStyle: pending ? "dashed" : "solid",
      }}
      className={cn(
        "flex-row items-center gap-1 overflow-hidden pr-1",
        pending && cn("border", classes.border)
      )}
    >
      <Tint className={classes.fill} opacity={pending ? 0.08 : 0.2} />
      {!bar.continuesLeft && !pending ? (
        <View testID="calendar-bar-edge" className={cn("h-full w-[3px]", classes.fill)} />
      ) : (
        <View className="w-[2px]" />
      )}
      {range.userId && width >= AVATAR_MIN_WIDTH ? (
        <PersonAvatar userId={range.userId} name={range.userName} size={13} />
      ) : null}
      {!bar.continuesLeft ? (
        <Text
          className="flex-1 text-[10.5px] font-semibold text-foreground"
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function BankPill({
  bar,
  cellWidth,
  testID,
  onPress,
}: {
  bar: PlacedBar;
  cellWidth: number;
  testID: string;
  onPress: () => void;
}) {
  const names = bar.range.names.join(", ");
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={names}
      style={{
        position: "absolute",
        left: bar.startColumn * cellWidth + 2,
        width: (bar.endColumn - bar.startColumn) * cellWidth - 4,
        top: BARS_TOP,
        height: BAR_H,
        borderStyle: "dashed",
      }}
      className="justify-center overflow-hidden rounded-[6px] border border-leave-bank px-1.5"
    >
      <Tint className="bg-leave-bank" opacity={0.16} />
      <Text className="text-[10.5px] font-bold text-leave-bank" numberOfLines={1}>
        {names}
      </Text>
    </Pressable>
  );
}

export function LaneMonth({
  month,
  ranges,
  width,
  viewerId,
  today,
  onDay,
  onBar,
  onMore,
}: LaneMonthProps) {
  const { t } = useTranslation();
  const cellWidth = (width - CALENDAR_GUTTER * 2 - 2) / 7;
  const weeks = buildWeeks(month);

  const labelOf = (range: CalendarRange) => {
    const name =
      range.userId === viewerId ? t.requests.you : firstName(range.userName ?? undefined, "?");
    return range.halfDay ? `${name} ½` : name;
  };

  return (
    <View
      testID={`calendar-month-${isoDay(month, 1).slice(0, 7)}`}
      style={{ width, paddingHorizontal: CALENDAR_GUTTER }}
    >
      <View className="overflow-hidden rounded-[16px] border border-border bg-card">
        <View className="flex-row border-b border-border bg-muted" style={{ height: HEADER_H }}>
          {t.calendar.weekdaysShort.map((weekday, index) => (
            <View key={weekday} style={{ width: cellWidth }} className="justify-center px-1.5">
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
          const { bank, shown, hidden, bankRows } = placeWeek(week, ranges, {
            maxLanes: MAX_LANES,
            viewerId,
          });
          return (
            <View
              key={week.find((day) => day !== null)}
              style={{ height: ROW_H }}
              className={cn("flex-row", weekIndex < weeks.length - 1 && "border-b border-border")}
            >
              {week.map((day, column) => {
                const iso = day === null ? null : isoDay(month, day);
                const isToday = iso === today;
                return (
                  <Pressable
                    // Seven fixed columns that never reorder: the column is the cell.
                    // eslint-disable-next-line @eslint-react/no-array-index-key
                    key={column}
                    testID={iso ? `calendar-day-${iso}` : undefined}
                    disabled={iso === null}
                    onPress={() => iso && onDay(iso)}
                    accessibilityRole={iso ? "button" : undefined}
                    style={{ width: cellWidth }}
                    className={cn(
                      "px-1 pt-1.5 active:bg-muted",
                      column < 6 && "border-r border-border",
                      (iso === null || column >= 5) && "bg-tint"
                    )}
                  >
                    {day !== null ? (
                      <View
                        className={cn(
                          "h-[22px] min-w-[22px] items-center justify-center self-start rounded-full px-1",
                          isToday && "bg-primary"
                        )}
                      >
                        <Text
                          className={cn(
                            "text-[12px]",
                            isToday
                              ? "font-bold text-primary-foreground"
                              : column >= 5
                                ? "text-faint"
                                : "font-medium text-muted-foreground"
                          )}
                        >
                          {day}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              {bank.map((bar) => {
                const iso = isoDay(month, week[bar.startColumn]!);
                return (
                  <BankPill
                    key={bar.range.id}
                    bar={bar}
                    cellWidth={cellWidth}
                    testID={`calendar-holiday-${iso}`}
                    onPress={() => onMore(iso)}
                  />
                );
              })}
              {shown.map((bar) => (
                <LaneBar
                  key={bar.range.id}
                  bar={bar}
                  cellWidth={cellWidth}
                  top={BARS_TOP + (bankRows + bar.lane) * (BAR_H + LANE_GAP)}
                  label={labelOf(bar.range)}
                  onBar={onBar}
                />
              ))}
              {[...hidden].map(([column, list]) => {
                const iso = isoDay(month, week[column]!);
                return (
                  <Pressable
                    key={column}
                    testID={`calendar-more-${iso}`}
                    onPress={() => onMore(iso)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t.dashboard.calendar.moreOnDay(
                      list.length,
                      t.calendar.dayTitle(dayParts(iso).weekday, dayParts(iso).date)
                    )}
                    style={{ position: "absolute", left: column * cellWidth + 3, bottom: 4 }}
                    className="rounded-full border border-input bg-muted px-1.5 py-[1px]"
                  >
                    <Text className="text-[10.5px] font-semibold text-muted-foreground">
                      {t.dashboard.calendar.more(list.length)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}
