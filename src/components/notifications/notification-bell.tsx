import { router } from "expo-router";
import { BellIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import { useHasUnreadNotifications, useRereadNotificationsOnFocus } from "@/lib/query";

/** The bell in every tab's header: a dot while anything is unread, and the list behind it. */
export function NotificationBell() {
  const { t } = useTranslation();
  const unread = useHasUnreadNotifications();
  useRereadNotificationsOnFocus();

  return (
    <Pressable
      testID="notification-bell"
      onPress={() => router.push("/notifications")}
      accessibilityRole="button"
      accessibilityLabel={unread ? t.notifications.openUnread : t.notifications.open}
      className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:opacity-70"
    >
      <Icon icon={BellIcon} tone="foreground" size={20} />
      {unread ? (
        <View className="absolute top-[9px] right-[10px] h-2.5 w-2.5 rounded-full border-2 border-card bg-warm" />
      ) : null}
    </Pressable>
  );
}
