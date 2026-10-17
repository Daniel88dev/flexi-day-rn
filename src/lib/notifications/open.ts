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

/**
 * Where a push tap goes. Unlike the list's follower, it can land on any screen: a request stacks
 * over whatever is open, My attendance is a tab of the shell so whatever covers the shell goes
 * first, and a link the phone has no screen for opens the notification list.
 */
export function followPushRoute(route: NotificationRoute): void {
  if (route.kind === "request") {
    router.push(route.href);
  } else if (route.kind === "attendance") {
    if (router.canDismiss()) router.dismissAll();
    router.navigate(route.href);
  } else {
    router.navigate("/notifications");
  }
}

/** A tap on a push: the notification it names is marked read, then its link is followed. */
export function openPushTap(
  push: { notificationId: string | null; href: string | null },
  {
    markRead,
    follow = followPushRoute,
  }: { markRead: (id: string) => void; follow?: (route: NotificationRoute) => void }
): NotificationRoute {
  if (push.notificationId) markRead(push.notificationId);
  const route = notificationRoute(push.href);
  follow(route);
  return route;
}
