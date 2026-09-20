import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const TONES = {
  error: { surface: "bg-danger-soft", text: "text-danger" },
  success: { surface: "bg-ok-soft", text: "text-ok" },
  accent: { surface: "bg-accent", text: "text-accent-foreground" },
} as const;

export type NoticeTone = keyof typeof TONES;

export function Notice({ message, tone }: { message: string; tone: NoticeTone }) {
  const { surface, text } = TONES[tone];
  return (
    <View className={cn("rounded-2xl px-4 py-3", surface)}>
      <Text className={cn("text-[14px] leading-5", text)}>{message}</Text>
    </View>
  );
}
