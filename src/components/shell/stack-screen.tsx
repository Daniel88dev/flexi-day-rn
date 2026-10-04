import { router } from "expo-router";
import { CaretLeftIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";

/** A screen's title beside the back button, or, one level deeper, only the screen it goes back to. */
type Header = { title: string; backLabel?: never } | { backLabel: string; title?: never };

/**
 * A destination reached from the More sheet: it pushes over the tab bar rather than replacing a
 * tab, so it carries its own way back. Without children it is a placeholder.
 */
export function StackScreen({
  title,
  backLabel,
  children,
  testID,
}: Header & { children?: ReactNode; testID?: string }) {
  const { t } = useTranslation();
  const name = title ?? backLabel;
  return (
    <View testID={testID} className="flex-1 bg-background pt-safe pb-safe">
      <View className="h-14 flex-row items-center gap-1 px-3">
        <Pressable
          testID="stack-back"
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={name}
          className={cn(
            "h-10 flex-row items-center rounded-full active:opacity-70",
            backLabel === undefined ? "w-10 justify-center" : "gap-0.5 pr-2"
          )}
        >
          <Icon icon={CaretLeftIcon} tone="foreground" size={22} weight="bold" />
          {backLabel === undefined ? null : (
            <Text className="text-[16px] text-foreground">{backLabel}</Text>
          )}
        </Pressable>
        {title === undefined ? null : (
          <Text className="font-display text-[19px] font-semibold text-foreground">{title}</Text>
        )}
      </View>
      {children ?? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[15px] text-faint">{t.common.comingSoon(name)}</Text>
        </View>
      )}
    </View>
  );
}
