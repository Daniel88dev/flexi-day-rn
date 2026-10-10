// PROTOTYPE (T-265): the lanes month with adjacent-month days, in three variants. Throwaway.
import { Pressable, View } from "react-native";

import { PersonAvatar } from "@/components/calendar/person-avatar";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  isFixture,
  paddedWeeks,
  protoPlaceWeek,
  seamColumn,
  seamLabel,
  splitAtBoundary,
  type ProtoCell,
  type ProtoPlacedBar,
  type ProtoRange,
  type ProtoVariant,
  type ProtoWeek,
} from "@/lib/calendar/prototype-adjacent";
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
export const PROTO_FADE = 0.4;
/** Lighter than the weekend numbers, which are already `text-faint`. */
export const PROTO_ADJACENT_NUMBER_OPACITY = 0.55;

function Tint({ className, opacity }: { className: string; opacity: number }) {
  return <View className={cn("absolute inset-0", className)} style={{ opacity }} />;
}

/** Variant C's "unknown" marker for days the sync pull never reached. */
export function ProtoHatch() {
  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }, (_, i) => (
        <View
          key={i}
          className="absolute bg-input"
          style={{
            left: i * 9 - 40,
            top: -20,
            width: 1.5,
            height: 200,
            transform: [{ rotate: "35deg" }],
          }}
        />
      ))}
    </View>
  );
}

function ProtoLaneBar({
  bar,
  cellWidth,
  top,
  label,
  fade,
  onBar,
}: {
  bar: ProtoPlacedBar;
  cellWidth: number;
  top: number;
  label: string;
  fade: number;
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
  const tappable = onBar && !isFixture(range);

  return (
    <Pressable
      onPress={tappable ? () => onBar(range.vacationIds[0]) : undefined}
      disabled={range.pending}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        opacity: (range.pending ? 0.55 : 1) * fade,
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
        <View className={cn("h-full w-[3px]", classes.fill)} />
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

function ProtoBankPill({
  bar,
  cellWidth,
  fade,
  onPress,
}: {
  bar: ProtoPlacedBar;
  cellWidth: number;
  fade: number;
  onPress: () => void;
}) {
  const names = bar.range.names.join(", ");
  return (
    <Pressable
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
        opacity: fade,
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

/** Variant B splits at the month boundary and fades the outside piece; A and C draw as one. */
function segmentsOf(bar: ProtoPlacedBar, week: ProtoWeek, variant: ProtoVariant) {
  if (variant !== "B") return [{ ...bar, fade: 1, key: bar.range.id }];
  return splitAtBoundary(bar, week).map((segment) => ({
    ...segment,
    fade: segment.outside ? PROTO_FADE : 1,
    key: `${bar.range.id}|${segment.startColumn}`,
  }));
}

export function ProtoLaneMonth({
  month,
  ranges,
  width,
  viewerId,
  today,
  variant,
  syncedFrom,
  onDay,
  onBar,
  onMore,
}: {
  month: YearMonth;
  ranges: readonly ProtoRange[];
  width: number;
  viewerId: string | null;
  today: string;
  variant: ProtoVariant;
  syncedFrom: string;
  onDay: (day: string) => void;
  onBar?: (vacationId: string) => void;
  onMore: (day: string) => void;
}) {
  const { t } = useTranslation();
  const cellWidth = (width - CALENDAR_GUTTER * 2 - 2) / 7;
  const weeks = paddedWeeks(month, syncedFrom);

  const labelOf = (range: ProtoRange) => {
    const name =
      range.userId === viewerId ? t.requests.you : firstName(range.userName ?? undefined, "?");
    return range.halfDay ? `${name} ½` : name;
  };

  const renderCell = (cell: ProtoCell, column: number, week: ProtoWeek, weekIndex: number) => {
    const adjacent = !cell.inMonth;
    const blank = adjacent && cell.unsynced && variant === "B";
    const unknown = adjacent && cell.unsynced && variant === "C";
    const inert = blank || unknown;
    const isToday = cell.iso === today;
    const label = variant === "C" ? seamLabel(week, column, weekIndex) : null;
    return (
      <Pressable
        key={column}
        testID={`calendar-day-${cell.iso}`}
        disabled={inert}
        onPress={() => onDay(cell.iso)}
        accessibilityRole={inert ? undefined : "button"}
        style={{ width: cellWidth }}
        className={cn(
          "px-1 pt-1.5 active:bg-muted",
          column < 6 && "border-r border-border",
          (adjacent || column >= 5) && "bg-tint"
        )}
      >
        {unknown ? <ProtoHatch /> : null}
        {blank ? null : (
          <View className="flex-row items-center gap-[3px]">
            <View
              className={cn(
                "h-[22px] min-w-[22px] items-center justify-center self-start rounded-full px-1",
                isToday && "bg-primary"
              )}
              style={adjacent ? { opacity: PROTO_ADJACENT_NUMBER_OPACITY } : undefined}
            >
              <Text
                className={cn(
                  "text-[12px]",
                  isToday
                    ? "font-bold text-primary-foreground"
                    : adjacent || column >= 5
                      ? "text-faint"
                      : "font-medium text-muted-foreground"
                )}
              >
                {cell.day}
              </Text>
            </View>
            {label ? (
              <Text className="text-[9.5px] font-bold text-muted-foreground uppercase">
                {label}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
    );
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
          const { bank, shown, hidden, bankRows } = protoPlaceWeek(week, ranges, {
            maxLanes: MAX_LANES,
            viewerId,
          });
          const seam = variant === "C" ? seamColumn(week) : null;
          return (
            <View
              key={week[0].iso}
              style={{ height: ROW_H }}
              className={cn("flex-row", weekIndex < weeks.length - 1 && "border-b border-border")}
            >
              {week.map((cell, column) => renderCell(cell, column, week, weekIndex))}
              {seam !== null ? (
                <View
                  pointerEvents="none"
                  className="absolute bg-input"
                  style={{ left: seam * cellWidth - 0.75, width: 1.5, top: 0, bottom: 0 }}
                />
              ) : null}
              {bank.flatMap((bar) =>
                segmentsOf(bar, week, variant).map((segment) => (
                  <ProtoBankPill
                    key={segment.key}
                    bar={segment}
                    cellWidth={cellWidth}
                    fade={segment.fade}
                    onPress={() => onMore(week[bar.startColumn].iso)}
                  />
                ))
              )}
              {shown.flatMap((bar) =>
                segmentsOf(bar, week, variant).map((segment) => (
                  <ProtoLaneBar
                    key={segment.key}
                    bar={segment}
                    cellWidth={cellWidth}
                    top={BARS_TOP + (bankRows + bar.lane) * (BAR_H + LANE_GAP)}
                    label={labelOf(bar.range)}
                    fade={segment.fade}
                    onBar={onBar}
                  />
                ))
              )}
              {[...hidden].map(([column, list]) => (
                <Pressable
                  key={column}
                  onPress={() => onMore(week[column].iso)}
                  hitSlop={6}
                  accessibilityRole="button"
                  style={{ position: "absolute", left: column * cellWidth + 3, bottom: 4 }}
                  className="rounded-full border border-input bg-muted px-1.5 py-[1px]"
                >
                  <Text className="text-[10.5px] font-semibold text-muted-foreground">
                    {t.dashboard.calendar.more(list.length)}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}
