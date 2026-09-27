import { router } from "expo-router";

import type { AppNotification } from "@/lib/query";

import { notificationRoute, type NotificationRoute } from "./route";

/**
 * Leaves the notification list for where a notification points. A request stacks over the list,
 * so Back returns to it. My attendance is a tab of the shell under the list, so the list leaves
 * first: navigating to a tab from a root-stack screen pushes a second shell.
 */
export function followNotificationRoute(route: NotificationRoute): void {
  if (route.kind === "request") {
    router.push(route.href);
  } else if (route.kind === "attendance") {
    router.back();
    router.navigate(route.href);
  }
}

/**
 * A tap on a notification in the list: an unread one is marked read first, then its link is
 * followed. One with nowhere else to go stays on the list.
 */
export function openNotification(
  notification: AppNotification,
  {
    markRead,
    follow = followNotificationRoute,
  }: { markRead: (id: string) => void; follow?: (route: NotificationRoute) => void }
): NotificationRoute {
  if (notification.readAt === null) markRead(notification.id);
  const route = notificationRoute(notification.href);
  if (route.kind !== "list") follow(route);
  return route;
}
