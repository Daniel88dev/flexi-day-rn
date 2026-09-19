import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

export function SyncingDashboard() {
  const { t } = useTranslation();
  return (
    <View className="items-center rounded-3xl border border-border bg-card px-6 py-8">
      <Text className="font-display text-[19px] font-semibold text-foreground">
        {t.sync.syncing}
      </Text>
    </View>
  );
}
