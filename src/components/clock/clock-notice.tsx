import type { Icon as PhosphorIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon, type Tone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const TONES = {
  accent: { surface: "bg-accent", icon: "primary" },
  muted: { surface: "bg-muted", icon: "muted" },
  warn: { surface: "bg-warm-soft", icon: "warm" },
  danger: { surface: "bg-danger-soft", icon: "danger" },
} as const satisfies Record<string, { surface: string; icon: Tone }>;

export function ClockNotice({
  tone,
  icon,
  title,
  body,
  children,
  testID,
}: {
  tone: keyof typeof TONES;
  icon: PhosphorIcon;
  title: string;
  body?: string;
  children?: ReactNode;
  testID?: string;
}) {
  const { surface, icon: iconTone } = TONES[tone];
  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      className={cn("flex-row gap-3 rounded-[16px] p-3.5", surface)}
    >
      <View className="pt-0.5">
        <Icon icon={icon} tone={iconTone} size={18} weight="bold" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[14.5px] font-semibold text-foreground">{title}</Text>
        {body ? (
          <Text className="text-[13.5px] leading-[19px] text-muted-foreground">{body}</Text>
        ) : null}
        {children ? <View className="mt-1.5 flex-row flex-wrap gap-2">{children}</View> : null}
      </View>
    </View>
  );
}

export function NoticeAction({
  label,
  icon,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  icon?: PhosphorIcon;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn(
        "h-9 flex-row items-center gap-1.5 rounded-full border border-input bg-card px-3.5 active:opacity-80",
        disabled && "opacity-50"
      )}
    >
      {icon ? <Icon icon={icon} tone="foreground" size={15} weight="bold" /> : null}
      <Text className="text-[13.5px] font-semibold text-foreground">{label}</Text>
    </Pressable>
  );
}
