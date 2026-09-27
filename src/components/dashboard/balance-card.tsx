import { View } from "react-native";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { balanceRows } from "@/lib/dashboard/balance";
import { useBalanceBuckets } from "@/lib/local-store";

export function BalanceCard({ year }: { year: number }) {
  const { t } = useTranslation();
  const labels = t.dashboard.balance;
  const rows = balanceRows(useBalanceBuckets(year));

  return (
    <DashboardCard testID="balance-card" title={labels.title(year)}>
      {rows.length === 0 ? (
        <Text className="text-[14px] text-muted-foreground">{labels.noQuota(year)}</Text>
      ) : (
        <View className="gap-4">
          {rows.map((row) => (
            <View key={row.type} testID={`balance-${row.type}`}>
              <View className="mb-2 flex-row items-baseline justify-between gap-3">
                <Text className="text-[13.5px] font-semibold text-foreground">
                  {t.recordTypes[row.type]}
                </Text>
                <Text className="text-[13px] text-muted-foreground tabular-nums">
                  <Text
                    className={cn("font-bold", row.left < 0 ? "text-danger" : "text-foreground")}
                  >
                    {row.left}
                  </Text>
                  {labels.ofAllowance(row.allocated)}
                  {row.pending > 0 ? (
                    <Text className="text-faint">{labels.pending(row.pending)}</Text>
                  ) : null}
                </Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-muted">
                <View
                  className={cn("h-2 rounded-full", LEAVE_CLASSES[row.type].fill)}
                  style={{ width: `${row.share * 100}%` }}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </DashboardCard>
  );
}
