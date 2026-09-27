import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { useTranslation } from "@/i18n/use-translation";
import { deviceAppState } from "@/lib/app-state";
import { useClockRead, useMonthRead, type AttendanceState } from "@/lib/attendance";
import { yearMonthOf } from "@/lib/attendance/range";
import { dayOfDate, firstOfNextMonth } from "@/lib/days";
import { useSyncStatus } from "@/lib/local-store";
import { qk } from "@/lib/query";

import { CLOCK_REMINDER_PREFIX, type ReminderCopy } from "./apply";
import { notificationPermission, reminderPrefs, reminderScheduler } from "./device";
import type { NotificationPermission } from "./permission";
import { planClockReminders } from "./plan";
import type { ReminderPrefs } from "./prefs";

export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(reminderPrefs.subscribe, reminderPrefs.read);
}

/** iOS's answer for this app, read again on every foreground: Settings can change it any time. */
export function useNotificationPermission(): NotificationPermission {
  useEffect(() => {
    void notificationPermission.refresh();
    return deviceAppState.subscribe(() => void notificationPermission.refresh());
  }, []);
  return useSyncExternalStore(notificationPermission.subscribe, notificationPermission.read);
}

/**
 * The clock and the months the reminders plan from, under the keys My attendance uses, read only
 * while attendance is active. A session open since before midnight on the 1st also needs the
 * month it started in.
 */
export function useReminderReads() {
  const { view } = useClockRead();
  const state = view.kind === "ready" ? view.state : null;
  const active = state !== null && state.active && !state.employmentEnded;
  const organizationId = active ? state.organizationId : null;
  const today = state?.businessDate ?? dayOfDate(new Date());
  const thisMonth = useMonthRead(organizationId, today);
  const nextMonth = useMonthRead(organizationId, firstOfNextMonth(today));
  const openDate = state?.openSession?.businessDate ?? today;
  const openMonth = useMonthRead(organizationId, openDate);
  return { view, active, organizationId, today, openDate, thisMonth, nextMonth, openMonth };
}

/**
 * It changes nothing until it knows enough: a clock read that got no answer, or a month still
 * loading or failed, leaves what is scheduled alone.
 */
export function useClockReminders(permission: NotificationPermission): void {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { view, active, organizationId, today, openDate, thisMonth, nextMonth, openMonth } =
    useReminderReads();
  const prefs = useReminderPrefs();
  const pulledAt = useSyncStatus().lastPulledAt;
  const seenPullRef = useRef(pulledAt);

  const copy = useMemo<ReminderCopy>(
    () => ({ "clock-in": t.reminders.clockIn, "clock-out": t.reminders.clockOut }),
    [t]
  );

  useEffect(() => {
    const previous = seenPullRef.current;
    seenPullRef.current = pulledAt;
    if (previous === null || previous === pulledAt || !organizationId) return;
    for (const date of new Set([openDate, today, firstOfNextMonth(today)])) {
      const { year, month } = yearMonthOf(date);
      void queryClient.invalidateQueries({
        queryKey: qk.attendanceMonth(year, month, organizationId),
        exact: true,
      });
    }
  }, [pulledAt, organizationId, today, openDate, queryClient]);

  // Declared before the apply effect, so a fresh shell arms the scheduler before it plans.
  useEffect(() => reminderScheduler.arm(), []);

  const current: AttendanceState | null | undefined =
    view.kind === "no-employment" ? null : view.kind === "ready" ? view.state : undefined;
  const readAt = view.kind === "ready" ? view.readAt : 0;
  const thisMonthData = thisMonth.data;
  const nextMonthData = nextMonth.data;
  const openMonthData = openMonth.data;

  // `readAt` and the months' update times change on every answer, even one equal to the last.
  useEffect(() => {
    if (permission === "unknown" || current === undefined) return;
    if (active && (!thisMonthData || !nextMonthData || !openMonthData)) return;

    const plan =
      permission === "granted"
        ? planClockReminders({
            prefs,
            current,
            months: [...new Set([openMonthData, thisMonthData, nextMonthData])].filter(
              (month) => month !== undefined
            ),
            now: Date.now(),
          })
        : [];
    void reminderScheduler.apply(plan, copy);
  }, [
    current,
    readAt,
    active,
    thisMonthData,
    nextMonthData,
    openMonthData,
    thisMonth.dataUpdatedAt,
    nextMonth.dataUpdatedAt,
    openMonth.dataUpdatedAt,
    prefs,
    permission,
    copy,
  ]);
}

export function useClockReminderTaps(): void {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (!response.notification.request.identifier.startsWith(CLOCK_REMINDER_PREFIX)) return;
    Notifications.clearLastNotificationResponse();
    router.push("/clock");
  }, [response]);
}

let introOpened = false;

/**
 * The one-time explainer, once the shell is up after sign-in, while iOS has not been asked yet.
 * It is never shown again on this phone once dismissed, whoever signs in next.
 */
export function useNotificationsIntro(permission: NotificationPermission): void {
  useEffect(() => {
    if (introOpened || permission !== "undetermined" || reminderPrefs.introSeen()) return;
    introOpened = true;
    router.push("/notifications-intro");
  }, [permission]);
}
