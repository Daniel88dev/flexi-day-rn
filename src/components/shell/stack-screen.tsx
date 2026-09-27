import { router } from "expo-router";
import { CaretLeftIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

/**
 * A destination reached from the More sheet: it pushes over the tab bar rather than replacing a
 * tab, so it carries its own way back. Without children it is a placeholder.
 */
export function StackScreen({ title, children }: { title: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      <View className="h-14 flex-row items-center gap-1 px-3">
        <Pressable
          testID="stack-back"
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={title}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon icon={CaretLeftIcon} tone="foreground" size={22} weight="bold" />
        </Pressable>
        <Text className="font-display text-[19px] font-semibold text-foreground">{title}</Text>
      </View>
      {children ?? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[15px] text-faint">{t.common.comingSoon(title)}</Text>
        </View>
      )}
    </View>
  );
}
