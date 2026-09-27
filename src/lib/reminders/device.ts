import * as Notifications from "expo-notifications";
import { SQLiteStorage } from "expo-sqlite/kv-store";

import { createReminderScheduler, type Notifier } from "./apply";
import { createPermissionSource, type PermissionApi } from "./permission";
import { createReminderPrefs } from "./prefs";

// A reminder that fires while the app is open still shows, since the person may be in it
// without having clocked.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const notifier: Notifier = {
  async scheduled() {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests.map((request) => {
      const data = (request.content.data ?? {}) as Record<string, unknown>;
      return {
        identifier: request.identifier,
        title: request.content.title,
        body: request.content.body,
        fireAt: typeof data.fireAt === "number" ? data.fireAt : Number.NaN,
        data,
      };
    });
  },
  cancel: (identifier) => Notifications.cancelScheduledNotificationAsync(identifier),
  async schedule(reminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: reminder.data,
        sound: "default",
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt },
    });
  },
};

function permissionOf(
  status: Notifications.NotificationPermissionsStatus
): "granted" | "denied" | "undetermined" {
  switch (status.ios?.status) {
    case Notifications.IosAuthorizationStatus.NOT_DETERMINED:
      return "undetermined";
    case Notifications.IosAuthorizationStatus.DENIED:
      return "denied";
    case undefined:
      return status.status === "granted" || status.status === "denied"
        ? status.status
        : "undetermined";
    default:
      return "granted";
  }
}

const permissionApi: PermissionApi = {
  get: async () => permissionOf(await Notifications.getPermissionsAsync()),
  request: async () =>
    permissionOf(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: true },
      })
    ),
};

/** Its own file beside the Local store's, so a store rebuild never reaches it. */
export const reminderPrefs = createReminderPrefs(new SQLiteStorage("flexi-day-prefs.db"));

export const reminderScheduler = createReminderScheduler(notifier);

export const notificationPermission = createPermissionSource(permissionApi);

export async function clearClockReminders(): Promise<void> {
  const cancelled = reminderScheduler.clear();
  try {
    reminderPrefs.clear();
  } finally {
    await cancelled;
  }
}
