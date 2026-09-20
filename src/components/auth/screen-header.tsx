import { CaretLeftIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { LogoMark, Wordmark } from "@/components/ui/logo";

export function ScreenHeader({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-2">
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
      >
        <Icon icon={CaretLeftIcon} tone="foreground" size={20} weight="bold" />
      </Pressable>
      <View className="flex-row items-center gap-2">
        <LogoMark size={24} />
        <Wordmark size={22} />
      </View>
      <View className="w-10" />
    </View>
  );
}
