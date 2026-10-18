import type { ReactNode } from "react";
import { View } from "react-native";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function TabHeader({
  title,
  beforeBell,
  afterBell,
  className,
}: {
  title: string;
  beforeBell?: ReactNode;
  afterBell?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("flex-row items-center justify-between gap-3", className)}>
      <Text
        className="font-display text-[28px] font-semibold text-foreground"
        style={{ letterSpacing: -0.56 }}
      >
        {title}
      </Text>
      <View className="max-w-[65%] flex-row items-center gap-2">
        {beforeBell}
        <NotificationBell />
        {afterBell}
      </View>
    </View>
  );
}
