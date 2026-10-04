import { View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

export function MemberPlaceholder({ userId, period }: { userId: string; period?: string }) {
  const { t } = useTranslation();
  const periodLabel = !period || period === "rolling" ? t.report.periodRolling : period;
  return (
    <StackScreen testID="report-member" title={t.nav.report}>
      <View className="flex-1 items-center justify-center gap-1 px-8">
        <Text testID="report-member-user" className="text-center text-[15px] text-foreground">
          {userId}
        </Text>
        <Text testID="report-member-period" className="text-center text-[15px] text-faint">
          {periodLabel}
        </Text>
      </View>
    </StackScreen>
  );
}
