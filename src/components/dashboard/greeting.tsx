import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { firstName } from "@/lib/viewer/viewer";
import type { Viewer } from "@/lib/viewer/use-viewer";

export type GreetingKey = "night" | "morning" | "afternoon" | "evening";

export function greetingKey(hour: number): GreetingKey {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function Greeting({ viewer }: { viewer: Viewer | null }) {
  const { t } = useTranslation();
  const name = firstName(viewer?.name, t.dashboard.fallbackName);
  return (
    <View>
      <Text
        className="font-display text-[28px] font-semibold text-foreground"
        style={{ letterSpacing: -0.56 }}
      >
        {t.dashboard.greeting(t.dashboard.greetings[greetingKey(new Date().getHours())], name)}
      </Text>
      <Text className="mt-1 text-[15px] leading-5 text-muted-foreground">
        {t.dashboard.subtitle}
      </Text>
    </View>
  );
}
