import { View } from "react-native";

import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { figuresLine, type AttendanceMonth } from "@/lib/attendance";

import { BalanceChip, TagChip } from "./chips";

/**
 * The day's figures from its `/month` entry: the backend's worked time, never the phone's. It
 * moves when the month is read again, not with the clock.
 */
export function DayFigures({
  month,
  date,
  loading,
}: {
  month: AttendanceMonth | undefined;
  date: string;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const day = month?.days.find((entry) => entry.businessDate === date);

  if (!month || !day) {
    if (loading)
      return <View testID="figures-loading" className="h-6 w-44 rounded-full bg-muted" />;
    return null;
  }

  const line = figuresLine(day, month.balanceMode, t);
  return (
    <View testID="day-figures" className="flex-row flex-wrap items-center gap-2">
      <Text className="text-[14.5px] font-semibold text-foreground" style={TABULAR}>
        {line.text}
      </Text>
      {line.balance !== null ? (
        <BalanceChip testID="figures-balance" minutes={line.balance} />
      ) : null}
      {line.tag ? <TagChip testID="figures-tag" label={line.tag} /> : null}
    </View>
  );
}
