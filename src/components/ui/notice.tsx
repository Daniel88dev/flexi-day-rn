import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const TONES = {
  error: { surface: "bg-danger-soft", text: "text-danger" },
  success: { surface: "bg-ok-soft", text: "text-ok" },
  accent: { surface: "bg-accent", text: "text-accent-foreground" },
} as const;

export type NoticeTone = keyof typeof TONES;

export type NoticeAction = { label: string; onPress: () => void; testID?: string };

export function Notice({
  message,
  tone,
  action,
}: {
  message: string;
  tone: NoticeTone;
  action?: NoticeAction;
}) {
  const { surface, text } = TONES[tone];
  return (
    <View className={cn("gap-3 rounded-2xl px-4 py-3", surface)}>
      <Text className={cn("text-[14px] leading-5", text)}>{message}</Text>
      {action ? (
        <Pressable
          testID={action.testID}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          className="self-start rounded-full bg-card px-4 py-1.5 active:opacity-70"
        >
          <Text className="text-[14px] font-semibold text-foreground">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
