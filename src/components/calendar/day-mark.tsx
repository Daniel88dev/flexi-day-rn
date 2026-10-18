import { CakeIcon } from "phosphor-react-native";
import { View } from "react-native";

import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import {
  DAY_MARK_METRICS,
  dayMark,
  weekRibbons,
  type DayMarkCounts,
  type DayMarkSize,
  type EventSpan,
} from "@/lib/calendar/day-mark";
import { cn } from "@/lib/cn";

export const BIRTHDAY_PINK = "#e0619a";

/**
 * The mark sits inside the day cell's pressable, which hides it from the accessibility tree, so the
 * cell's own label names what it shows.
 */
export function markLabels(t: Dictionary, counts: DayMarkCounts | undefined): string[] {
  const events = counts?.events ?? 0;
  const birthdays = counts?.birthdays ?? 0;
  return [
    ...(events > 0 ? [t.groupEvents.count(events)] : []),
    ...(birthdays > 0 ? [t.dashboard.calendar.birthdayCount(birthdays)] : []),
  ];
}

/**
 * A day's birthdays and group events, capped to what `room` holds. Lanes lay it out in a row
 * beside the day number; stripes stack it, cake over dot, in the cell's corner.
 */
export function DayMark({
  counts,
  room,
  size,
}: {
  counts: DayMarkCounts;
  room: number;
  size: DayMarkSize;
}) {
  const ink = useTone("foreground");
  const parts = dayMark({ ...counts, room, size });
  if (!parts) return null;

  const metrics = DAY_MARK_METRICS[size];
  return (
    <View
      pointerEvents="none"
      style={
        size === "stripe"
          ? { position: "absolute", top: 2, right: 3, width: parts.width, gap: 2 }
          : { width: parts.width, gap: metrics.gap }
      }
      className={cn(size === "stripe" ? "items-end" : "ml-auto flex-row items-center")}
    >
      {parts.cake ? <CakeIcon size={metrics.cake} color={BIRTHDAY_PINK} weight="fill" /> : null}
      {parts.dot ? (
        <View className="flex-row items-center" style={{ gap: metrics.countGap }}>
          <View
            style={{
              width: metrics.dot,
              height: metrics.dot,
              borderRadius: metrics.dot / 2,
              backgroundColor: ink,
            }}
          />
          {parts.count !== null ? (
            <Text className="text-[9px] font-bold text-foreground">{parts.count}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Lanes: a thin ink ribbon along the top of the days a multi-day group event covers. */
export function EventRibbons({
  week,
  spans,
  cellWidth,
}: {
  week: readonly { date: string }[];
  spans: readonly EventSpan[];
  cellWidth: number;
}) {
  const ink = useTone("foreground");
  const dates = week.map((cell) => cell.date);
  return weekRibbons(dates, spans).map((ribbon) => (
    <View
      key={ribbon.key}
      testID={`calendar-ribbon-${ribbon.key.replace(":", "-")}-${dates[0]}`}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: ribbon.startColumn * cellWidth + 1,
        width: (ribbon.endColumn - ribbon.startColumn) * cellWidth - 2,
        height: 3,
        borderRadius: 2,
        backgroundColor: ink,
      }}
    />
  ));
}
