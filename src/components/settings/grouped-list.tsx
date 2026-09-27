import type { Icon as PhosphorIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/** An iOS inset group: a label over one card of rows, a footnote under it. */
export function Section({
  label,
  footer,
  testID,
  children,
}: {
  label?: string;
  footer?: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View testID={testID}>
      {label ? (
        <Text className="px-4 pb-1.5 text-[11px] font-bold tracking-[1px] text-faint uppercase">
          {label}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-[24px] bg-card">{children}</View>
      {footer ? (
        <Text className="px-4 pt-2 text-[12.5px] leading-[18px] text-faint">{footer}</Text>
      ) : null}
    </View>
  );
}

/** The hairline between two rows of a section, inset past the icon the way iOS draws it. */
export function Divider() {
  return <View className="ml-[48px] h-px bg-border" />;
}

export function Row({
  icon,
  label,
  value,
  accessory,
  onPress,
  accessibilityRole = "button",
  testID,
}: {
  icon: PhosphorIcon;
  label: string;
  value?: string | null;
  accessory?: ReactNode;
  onPress?: () => void;
  accessibilityRole?: "button" | "link";
  testID?: string;
}) {
  const content = (
    <>
      <Icon icon={icon} tone="muted" />
      <Text className="flex-1 text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text className="max-w-[55%] text-[14.5px] text-faint" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
    </>
  );
  const className = "min-h-[52px] flex-row items-center gap-3 px-4 py-2";

  if (!onPress) {
    return (
      <View testID={testID} className={className}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      className={cn(className, "active:opacity-70")}
    >
      {content}
    </Pressable>
  );
}
