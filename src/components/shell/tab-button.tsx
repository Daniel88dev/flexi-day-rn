import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { Pressable, type PressableProps } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type TabButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  icon: PhosphorIcon;
  isFocused?: boolean;
};

/**
 * One slot of the tab bar, at the iOS row height so the labels clear the home indicator.
 * The layout is inline because `TabTrigger asChild` merges a row-direction style of its own
 * over anything `className` sets.
 */
const SLOT = {
  flex: 1,
  height: 50,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  paddingTop: 4,
} as const;

export function TabButton({ label, icon, isFocused, ...props }: TabButtonProps) {
  return (
    <Pressable
      {...props}
      style={SLOT}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <Icon
        icon={icon}
        tone={isFocused ? "primary" : "muted"}
        size={25}
        weight={isFocused ? "fill" : "regular"}
      />
      <Text
        className={cn(
          "text-[10px] font-semibold",
          isFocused ? "text-primary" : "text-muted-foreground"
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
