import { PlusIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/** A list row that adds one more of something: a tinted plus and the label in the primary colour. */
export function AddRow({
  label,
  onPress,
  testID,
  className,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn(
        "min-h-11 flex-row items-center gap-3 active:opacity-70",
        disabled && "opacity-50",
        className
      )}
    >
      <View className="h-7 w-7 items-center justify-center rounded-full bg-accent">
        <Icon icon={PlusIcon} tone="primary" size={15} weight="bold" />
      </View>
      <Text className="text-[15.5px] font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}
