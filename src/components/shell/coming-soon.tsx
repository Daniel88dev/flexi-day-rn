import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

/** A destination the frame reserves but nothing fills yet. */
export function ComingSoon({ screen }: { screen: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background px-8 pt-safe">
      <Text className="text-center text-[15px] text-faint">{t.common.comingSoon(screen)}</Text>
    </View>
  );
}
