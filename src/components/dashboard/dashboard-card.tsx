import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";

export function DashboardCard({
  title,
  badge,
  testID,
  children,
}: {
  title: string;
  badge?: ReactNode;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View testID={testID} className="rounded-[24px] border border-border bg-card p-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="font-display text-[16px] font-semibold text-foreground">{title}</Text>
        {badge}
      </View>
      {children}
    </View>
  );
}
