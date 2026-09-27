import {
  BatteryLowIcon,
  BellIcon,
  CalendarXIcon,
  ChatCircleTextIcon,
  StampIcon,
  TimerIcon,
  TrashIcon,
  TrayArrowDownIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { useRef } from "react";
import { Pressable, View } from "react-native";
import { Pressable as GesturePressable } from "react-native-gesture-handler";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/query";
import { ageMs, relativeAge } from "@/lib/relative-time";

const KIND_ICON: Record<string, PhosphorIcon> = {
  approval_requested: TrayArrowDownIcon,
  approval_decided: StampIcon,
  comment: ChatCircleTextIcon,
  session_auto_closed: TimerIcon,
  calendar_conflict: CalendarXIcon,
  balance_low: BatteryLowIcon,
};

function DeleteAction({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="notification-delete"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="ml-2 w-[84px] items-center justify-center gap-1 rounded-[16px] bg-danger active:opacity-80"
    >
      <Icon icon={TrashIcon} tone="onFill" size={20} weight="bold" />
      <Text className="text-[12.5px] font-semibold text-background">{label}</Text>
    </Pressable>
  );
}

export function NotificationRow({
  notification,
  now,
  onOpen,
  onDelete,
}: {
  notification: AppNotification;
  now: number;
  onOpen: (notification: AppNotification) => void;
  onDelete: (notification: AppNotification) => void;
}) {
  const { t } = useTranslation();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const unread = notification.readAt === null;
  const age = relativeAge(ageMs(notification.createdAt, now), t);
  const deleteLabel = t.notifications.deleteLabel(notification.title);

  const remove = () => {
    swipeableRef.current?.close();
    onDelete(notification);
  };

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <DeleteAction
          label={t.notifications.delete}
          accessibilityLabel={deleteLabel}
          onPress={remove}
        />
      )}
    >
      {/* The gesture handler's own Pressable: a core one also fires when a swipe lets go. */}
      <GesturePressable
        testID={`notification-${notification.id}`}
        onPress={() => onOpen(notification)}
        accessibilityRole="button"
        accessibilityLabel={[
          unread ? t.notifications.unread : null,
          notification.title,
          notification.body,
          age,
        ]
          .filter(Boolean)
          .join(". ")}
        accessibilityActions={[{ name: "delete", label: deleteLabel }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "delete") remove();
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <View className="flex-row gap-3 rounded-[16px] bg-card px-4 py-3.5">
          <View>
            <View
              className={cn(
                "h-10 w-10 items-center justify-center rounded-full",
                unread ? "bg-accent" : "bg-muted"
              )}
            >
              <Icon
                icon={KIND_ICON[notification.type] ?? BellIcon}
                tone={unread ? "primary" : "muted"}
                size={20}
              />
            </View>
            {unread ? (
              <View
                testID="notification-unread"
                className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-warm"
              />
            ) : null}
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-start gap-2">
              <Text
                className={cn(
                  "flex-1 text-[15.5px]",
                  unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                )}
                numberOfLines={2}
              >
                {notification.title}
              </Text>
              <Text className="mt-0.5 text-[12.5px] text-faint">{age}</Text>
            </View>
            <Text className="text-[14px] leading-5 text-muted-foreground" numberOfLines={2}>
              {notification.body}
            </Text>
          </View>
        </View>
      </GesturePressable>
    </ReanimatedSwipeable>
  );
}
