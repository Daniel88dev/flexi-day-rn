import { CakeIcon } from "phosphor-react-native";
import { View } from "react-native";

import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  DAY_MARK_METRICS,
  dayMark,
  type DayMarkCounts,
  type DayMarkSize,
} from "@/lib/calendar/day-mark";
import { cn } from "@/lib/cn";

export const BIRTHDAY_PINK = "#e0619a";

/**
 * A day's birthdays and group events, capped per S14 to what `room` holds. Lanes lay it out in a
 * row beside the day number; stripes stack it, cake over dot, in the cell's corner.
 */
export function DayMark({
  date,
  counts,
  room,
  size,
}: {
  date: string;
  counts: DayMarkCounts;
  room: number;
  size: DayMarkSize;
}) {
  const ink = useTone("foreground");
  const parts = dayMark({ ...counts, room, size });
  if (!parts) return null;

  const metrics = DAY_MARK_METRICS[size];
  const testID = `calendar-mark-${date}`;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={
        size === "stripe"
          ? { position: "absolute", top: 2, right: 3, width: parts.width, gap: 2 }
          : { width: parts.width, gap: metrics.gap }
      }
      className={cn(size === "stripe" ? "items-end" : "ml-auto flex-row items-center")}
    >
      {parts.cake ? (
        <View testID={`${testID}-cake`}>
          <CakeIcon size={metrics.cake} color={BIRTHDAY_PINK} weight="fill" />
        </View>
      ) : null}
      {parts.dot ? (
        <View className="flex-row items-center" style={{ gap: metrics.countGap }}>
          <View
            testID={`${testID}-dot`}
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
