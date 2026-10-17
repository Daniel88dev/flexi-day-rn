import * as Application from "expo-application";
import * as Notifications from "expo-notifications";

import { apiRequest } from "@/lib/query/runtime";
import { notificationPermission } from "@/lib/reminders/device";

import { createPushRegistrar } from "./client";
import { detectPushEnvironment } from "./environment";

const PATH = "/api/users/me/push-registration";

export const pushRegistrar = createPushRegistrar({
  api: {
    upsert: (registration) => apiRequest(PATH, { method: "PUT", body: registration }),
    remove: () => apiRequest(PATH, { method: "DELETE" }),
  },
  device: {
    token: async () => String((await Notifications.getDevicePushTokenAsync()).data),
    environment: () =>
      detectPushEnvironment({
        apsEnvironment: () => Application.getIosPushNotificationServiceEnvironmentAsync(),
        isSimulator: async () =>
          (await Application.getIosApplicationReleaseTypeAsync()) ===
          Application.ApplicationReleaseType.SIMULATOR,
      }),
    async unregister() {
      Notifications.clearLastNotificationResponse();
      await Promise.all([
        Notifications.unregisterForNotificationsAsync(),
        Notifications.setBadgeCountAsync(0),
        Notifications.dismissAllNotificationsAsync(),
      ]);
    },
    async setBadge(count) {
      await Notifications.setBadgeCountAsync(count);
    },
  },
});

/** A session swap drops the server's registration, and no foreground follows it. */
export const resyncPush = (): Promise<void> => pushRegistrar.sync(notificationPermission.read());
