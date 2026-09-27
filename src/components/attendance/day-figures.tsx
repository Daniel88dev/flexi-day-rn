import { View } from "react-native";

import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { figuresLine, formatSignedMinutes, type AttendanceMonth } from "@/lib/attendance";
import { cn } from "@/lib/cn";

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
        <View
          testID="figures-balance"
          className={cn(
            "rounded-full px-2 py-0.5",
            line.balance >= 0 ? "bg-ok-soft" : "bg-danger-soft"
          )}
        >
          <Text
            className={cn(
              "text-[12.5px] font-semibold",
              line.balance >= 0 ? "text-ok" : "text-danger"
            )}
            style={TABULAR}
          >
            {formatSignedMinutes(line.balance)}
          </Text>
        </View>
      ) : null}
      {line.tag ? (
        <View testID="figures-tag" className="rounded-full bg-muted px-2 py-0.5">
          <Text className="text-[12.5px] font-semibold text-muted-foreground">{line.tag}</Text>
        </View>
      ) : null}
    </View>
  );
}
