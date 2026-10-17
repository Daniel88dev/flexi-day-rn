import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useEffect, useEffectEvent } from "react";

import { deviceAppState } from "@/lib/app-state";
import { pull } from "@/lib/local-store";
import { openPushTap } from "@/lib/notifications/open";
import { qk, useNotifications, useNotificationWrites } from "@/lib/query";
import { notificationPermission, type NotificationPermission } from "@/lib/reminders";

import { pushClient, setAppBadge } from "./device";
import { pushPayload, unreadCount } from "./payload";

/** Cold start, sign-in, a permission change and every foreground send the registration again. */
export function usePushRegistration(permission: NotificationPermission): void {
  useEffect(() => {
    void pushClient.sync(permission);
  }, [permission]);

  useEffect(
    () =>
      deviceAppState.subscribe(() => {
        void notificationPermission.refresh().then((current) => pushClient.sync(current));
      }),
    []
  );
}

/** A push tapped while the app ran, or the one that launched it once the shell is up. */
export function usePushTaps(): void {
  const response = Notifications.useLastNotificationResponse();
  const { markRead } = useNotificationWrites();
  const open = useEffectEvent((payload: NonNullable<ReturnType<typeof pushPayload>>) =>
    openPushTap(payload, { markRead })
  );

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const payload = pushPayload(response.notification);
    if (!payload) return;
    Notifications.clearLastNotificationResponse();
    open(payload);
  }, [response]);
}

/** APNs sets the badge from `aps.badge`; every read of the list sets it again from the server. */
export function usePushBadge(): void {
  const { data } = useNotifications();
  useEffect(() => {
    if (!data) return;
    setAppBadge(unreadCount(data)).catch((error: unknown) =>
      console.warn("The app badge could not be set.", error)
    );
  }, [data]);
}

/** Request data lives in the Local store, so a push in the foreground pulls as well as reads. */
export function useForegroundPushRefresh(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (!pushPayload(notification)) return;
      void pull("refresh");
      void queryClient.invalidateQueries({ queryKey: qk.allNotifications() });
    });
    return () => subscription.remove();
  }, [queryClient]);
}
