import { TimerIcon } from "phosphor-react-native";
import { Pressable, View, type PressableProps } from "react-native";

import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/**
 * The bar's centre slot, lifted half out of the bar on a ring of page background the way the
 * web's `ClockSlot` is. It opens the attendance screen until the clock widget exists to open.
 */
const SLOT = {
  flex: 1,
  height: 50,
  alignItems: "center",
  justifyContent: "flex-end",
  paddingBottom: 6,
} as const;

export function ClockButton({
  label,
  ...props
}: Omit<PressableProps, "children"> & { label: string }) {
  const onPrimary = useTone("onPrimary");
  return (
    <Pressable {...props} accessibilityRole="button" accessibilityLabel={label} style={SLOT}>
      <View className="-mt-[26px] rounded-full bg-background p-[5px]">
        <View className="h-[54px] w-[54px] items-center justify-center rounded-full bg-primary">
          <TimerIcon color={onPrimary} size={26} />
        </View>
      </View>
      <Text className="text-[10px] font-semibold text-muted-foreground">{label}</Text>
    </Pressable>
  );
}
