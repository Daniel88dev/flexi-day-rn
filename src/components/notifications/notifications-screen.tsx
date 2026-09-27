import { router } from "expo-router";
import { BellSimpleIcon, CaretLeftIcon } from "phosphor-react-native";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, View } from "react-native";

import { NotificationRow } from "@/components/notifications/notification-row";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { openNotification } from "@/lib/notifications/open";
import {
  useNotifications,
  useNotificationWrites,
  useRereadNotificationsOnFocus,
  type AppNotification,
} from "@/lib/query";
import { useNow } from "@/lib/use-now";

const AGE_TICK_MS = 60_000;

function HeaderAction({
  testID,
  label,
  onPress,
  disabled,
  danger,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      className={cn("rounded-full px-3 py-2 active:opacity-70", disabled && "opacity-40")}
    >
      <Text className={cn("text-[15px] font-semibold", danger ? "text-danger" : "text-primary")}>
        {label}
      </Text>
    </Pressable>
  );
}

function Loading() {
  return (
    <View testID="notifications-loading" className="gap-2">
      {[0, 1, 2].map((index) => (
        <View key={index} className="h-[76px] rounded-[16px] bg-card" />
      ))}
    </View>
  );
}

function Empty() {
  const { t } = useTranslation();
  return (
    <View testID="notifications-empty" className="items-center gap-3 px-8 pt-20">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
        <Icon icon={BellSimpleIcon} tone="primary" size={26} />
      </View>
      <Text className="font-display text-[19px] font-semibold text-foreground">
        {t.notifications.empty}
      </Text>
      <Text className="text-center text-[14.5px] leading-5 text-faint">
        {t.notifications.emptyBody}
      </Text>
    </View>
  );
}

function Gap() {
  return <View className="h-2" />;
}

export function NotificationsScreen() {
  const { t } = useTranslation();
  const primary = useTone("primary");
  const now = useNow(AGE_TICK_MS);
  const query = useNotifications();
  const writes = useNotificationWrites();
  useRereadNotificationsOnFocus();
  const [refreshing, setRefreshing] = useState(false);

  const items = query.data ?? [];
  const unread = items.filter((notification) => notification.readAt === null).length;

  const refresh = () => {
    setRefreshing(true);
    void query.refetch().finally(() => setRefreshing(false));
  };

  const open = (notification: AppNotification) =>
    openNotification(notification, { markRead: writes.markRead });

  const remove = (notification: AppNotification) => {
    haptic("tap");
    writes.remove(notification.id);
  };

  const markAllRead = () => {
    haptic("success");
    writes.markAllRead();
  };

  const clearAll = () =>
    Alert.alert(t.notifications.clearConfirm.title, t.notifications.clearConfirm.body, [
      { text: t.notifications.clearConfirm.cancel, style: "cancel" },
      {
        text: t.notifications.clearConfirm.confirm,
        style: "destructive",
        onPress: () => {
          haptic("warning");
          writes.clearAll();
        },
      },
    ]);

  const failedEmpty = query.isError && !query.data;

  return (
    <View testID="notifications" className="flex-1 bg-background pt-safe">
      <View className="h-14 flex-row items-center justify-between gap-2 px-3">
        <Pressable
          testID="notifications-back"
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.notifications.back}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon icon={CaretLeftIcon} tone="foreground" size={22} weight="bold" />
        </Pressable>
        {items.length > 0 ? (
          <View className="flex-row items-center">
            {unread > 0 ? (
              <HeaderAction
                testID="notifications-mark-all-read"
                label={t.notifications.markAllRead}
                onPress={markAllRead}
                disabled={writes.busy !== null}
              />
            ) : null}
            <HeaderAction
              testID="notifications-clear-all"
              label={t.notifications.clearAll}
              onPress={clearAll}
              disabled={writes.busy !== null}
              danger
            />
          </View>
        ) : null}
      </View>

      <FlatList
        testID="notifications-list"
        data={items}
        keyExtractor={(notification) => notification.id}
        renderItem={({ item }) => (
          <NotificationRow notification={item} now={now} onOpen={open} onDelete={remove} />
        )}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View className="gap-1 pt-1 pb-4">
            <Text
              className="font-display text-[28px] font-semibold text-foreground"
              style={{ letterSpacing: -0.56 }}
            >
              {t.notifications.title}
            </Text>
            {items.length > 0 ? (
              <Text
                testID="notifications-unread-count"
                className="text-[14px] text-muted-foreground"
              >
                {unread > 0 ? t.notifications.unreadCount(unread) : t.notifications.allRead}
              </Text>
            ) : null}
            {failedEmpty ? (
              <View className="pt-3">
                <Notice
                  tone="error"
                  message={t.sync.unreachable}
                  action={{
                    label: t.request.retry,
                    onPress: refresh,
                    testID: "notifications-retry",
                  }}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={query.isPending ? <Loading /> : failedEmpty ? null : <Empty />}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
        }
      />
    </View>
  );
}
