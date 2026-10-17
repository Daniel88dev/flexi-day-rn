import type { Notification, NotificationBehavior } from "expo-notifications";

export type PushPayload = { notificationId: string | null; href: string | null };

/**
 * What the backend sends beside `aps`: the in-app notification's id and its web link. On iOS
 * `content.data` holds only an Expo push's `body` key, so the fields come from the raw userInfo
 * in `trigger.payload`. Null for anything the phone scheduled itself.
 */
export function pushPayload(notification: Notification): PushPayload | null {
  const { content } = notification.request;
  const trigger = notification.request.trigger as { type?: unknown; payload?: unknown } | null;
  if (trigger?.type !== "push") return null;
  const userInfo = (trigger.payload ?? {}) as Record<string, unknown>;
  const data = (content.data ?? {}) as Record<string, unknown>;
  const field = (key: string): string | null => {
    const value = userInfo[key] ?? data[key];
    return typeof value === "string" ? value : null;
  };
  return { notificationId: field("notificationId"), href: field("href") };
}

/**
 * How a notification shows while the app is open. A clock reminder still shows, since the person
 * may be in the app without having clocked; a push takes the unread count APNs sent as the badge.
 */
export function notificationBehavior(notification: Notification): NotificationBehavior {
  return {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: pushPayload(notification) !== null,
  };
}

export function unreadCount(list: readonly { readAt: string | null }[]): number {
  return list.filter((notification) => notification.readAt === null).length;
}
