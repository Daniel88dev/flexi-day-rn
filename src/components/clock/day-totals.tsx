import { View } from "react-native";

import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { formatMinutes, type DerivedClock } from "@/lib/attendance";

/**
 * The day so far, under the clock and on My attendance. Presence and breaks only: worked and
 * required time need the organization's rules, which are an admin's read.
 */
export function DayTotals({ totals }: { totals: DerivedClock["totals"] }) {
  const { t } = useTranslation();
  const cells = [
    { key: "presence", label: t.clock.presence, value: formatMinutes(totals.presenceMinutes) },
    { key: "breaks", label: t.clock.breaks, value: formatMinutes(totals.breakMinutes) },
    { key: "sessions", label: t.clock.sessions, value: String(totals.sessions) },
  ];
  return (
    <View className="flex-row border-t border-border pt-3.5" testID="day-totals">
      {cells.map((cell) => (
        <View key={cell.key} className="flex-1 gap-0.5">
          <Text className="text-[11px] font-bold tracking-[0.6px] text-faint uppercase">
            {cell.label}
          </Text>
          <Text className="text-[18px] font-semibold text-foreground" style={TABULAR}>
            {cell.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
