import { BellRingingIcon, CalendarCheckIcon, TimerIcon } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

function Point({ icon, title, body }: { icon: PhosphorIcon; title: string; body: string }) {
  return (
    <View className="flex-row gap-3.5">
      <View className="h-10 w-10 items-center justify-center rounded-[16px] bg-muted">
        <Icon icon={icon} tone="primary" size={20} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15.5px] font-semibold text-foreground">{title}</Text>
        <Text className="text-[14px] leading-[20px] text-muted-foreground">{body}</Text>
      </View>
    </View>
  );
}

/**
 * The one-time explainer before the iOS notification prompt. Continue asks iOS; Not now leaves
 * it unasked, so Settings can still ask later.
 */
export function NotificationsIntro({
  onContinue,
  onDismiss,
}: {
  onContinue: () => Promise<unknown>;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.reminders.intro;
  const [asking, setAsking] = useState(false);

  const proceed = async () => {
    setAsking(true);
    try {
      await onContinue();
    } finally {
      onDismiss();
    }
  };

  return (
    <View testID="notifications-intro" className="gap-7">
      <View className="gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-[16px] bg-accent">
          <Icon icon={BellRingingIcon} tone="primary" size={28} weight="fill" />
        </View>
        <View className="gap-1.5">
          <Text className="font-display text-[26px] leading-[32px] font-bold text-foreground">
            {copy.title}
          </Text>
          <Text className="text-[15px] leading-[21px] text-muted-foreground">{copy.body}</Text>
        </View>
      </View>

      <View className="gap-5">
        <Point icon={CalendarCheckIcon} title={copy.requests} body={copy.requestsBody} />
        <Point icon={TimerIcon} title={copy.reminders} body={copy.remindersBody} />
      </View>

      <View className="gap-1">
        <Button
          testID="notifications-intro-continue"
          label={copy.continue}
          loading={asking}
          onPress={() => void proceed()}
        />
        <Pressable
          testID="notifications-intro-not-now"
          accessibilityRole="button"
          onPress={onDismiss}
          disabled={asking}
          className="h-12 items-center justify-center rounded-full active:opacity-70"
        >
          <Text className="text-[15px] font-semibold text-primary">{copy.notNow}</Text>
        </Pressable>
      </View>
    </View>
  );
}
