import {
  useClockReminderTaps,
  useClockReminders,
  useNotificationPermission,
  useNotificationsIntro,
} from "@/lib/reminders";

/** The signed-in shell's reminder work, mounted once the Local store is open. Renders nothing. */
export function ClockReminders() {
  const permission = useNotificationPermission();
  useClockReminders(permission);
  useClockReminderTaps();
  useNotificationsIntro(permission);
  return null;
}
