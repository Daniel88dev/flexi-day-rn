import * as Application from "expo-application";
import * as Notifications from "expo-notifications";

import { apiRequest } from "@/lib/query/runtime";

import { createPushClient } from "./client";
import { detectPushEnvironment } from "./environment";

const PATH = "/api/users/me/push-registration";

export const pushClient = createPushClient({
  api: {
    register: (registration) => apiRequest(PATH, { method: "PUT", body: registration }),
    unregister: () => apiRequest(PATH, { method: "DELETE" }),
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
    async letGo() {
      Notifications.clearLastNotificationResponse();
      await Promise.all([
        Notifications.unregisterForNotificationsAsync(),
        Notifications.setBadgeCountAsync(0),
        Notifications.dismissAllNotificationsAsync(),
      ]);
    },
  },
});

export async function setAppBadge(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
