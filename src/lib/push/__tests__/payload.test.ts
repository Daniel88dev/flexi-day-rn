import type { Notification } from "expo-notifications";

import { notificationBehavior, pushPayload, unreadCount } from "../payload";

const ID = "6c7f2a1e-0b9d-4e3a-8f5c-2d1b0a9e8f7c";

function push(userInfo: Record<string, unknown>, data: Record<string, unknown> | null = null) {
  return {
    date: 0,
    request: {
      identifier: "apns-1",
      content: { title: "Approved", body: "Your request was approved", data },
      trigger: { type: "push", payload: userInfo },
    },
  } as unknown as Notification;
}

const clockReminder = {
  date: 0,
  request: {
    identifier: "clock-in:2026-10-19",
    content: { title: "Clock in", body: "Time to clock in", data: { fireAt: 1 } },
    trigger: { type: "date", value: 1 },
  },
} as unknown as Notification;

describe("pushPayload", () => {
  it("returns the notification id and link APNs carried beside aps", () => {
    const notification = push({
      aps: { alert: { title: "Approved", body: "…" }, badge: 3 },
      notificationId: ID,
      href: "https://flexi-day.com/requests?vacationId=v1",
    });

    expect(pushPayload(notification)).toEqual({
      notificationId: ID,
      href: "https://flexi-day.com/requests?vacationId=v1",
    });
  });

  it("returns the fields from the content data when the payload lacks them", () => {
    const notification = push({ aps: {} }, { notificationId: ID, href: "/my-attendance" });

    expect(pushPayload(notification)).toEqual({ notificationId: ID, href: "/my-attendance" });
  });

  it("returns nulls for a push that carries neither, or carries them as other types", () => {
    expect(pushPayload(push({ aps: {} }))).toEqual({ notificationId: null, href: null });
    expect(pushPayload(push({ aps: {}, notificationId: 7, href: ["x"] }))).toEqual({
      notificationId: null,
      href: null,
    });
  });

  it("returns null for a local clock reminder", () => {
    expect(pushPayload(clockReminder)).toBeNull();
  });
});

describe("notificationBehavior", () => {
  it("returns a banner with the badge APNs sent for a push in the foreground", () => {
    expect(notificationBehavior(push({ aps: { badge: 2 } }))).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });

  it("returns a banner that leaves the badge alone for a clock reminder", () => {
    expect(notificationBehavior(clockReminder)).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});

describe("unreadCount", () => {
  it("returns how many notifications are not read yet", () => {
    expect(
      unreadCount([{ readAt: null }, { readAt: "2026-10-17T08:00:00.000Z" }, { readAt: null }])
    ).toBe(2);
  });

  it("returns 0 for an empty list", () => {
    expect(unreadCount([])).toBe(0);
  });
});
