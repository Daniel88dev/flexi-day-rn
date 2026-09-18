import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

/** What the dashboard says until the local store has something to show. */
export function EmptyDashboard() {
  const { t } = useTranslation();
  return (
    <View className="items-center rounded-3xl border border-border bg-card px-6 py-8">
      <Text className="font-display text-[19px] font-semibold text-foreground">
        {t.dashboard.empty.title}
      </Text>
      <Text className="mt-2 text-center text-[14.5px] leading-5 text-muted-foreground">
        {t.dashboard.empty.body}
      </Text>
    </View>
  );
}
