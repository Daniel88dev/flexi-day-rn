import { router } from "expo-router";

import type { AppNotification } from "@/lib/query";

import { followNotificationRoute, followPushRoute, openNotification, openPushTap } from "../open";
import { notificationRoute } from "../route";
import { openWebPage } from "@/lib/web";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
    canDismiss: jest.fn(() => false),
  },
}));

jest.mock("@/lib/web", () => ({ openWebPage: jest.fn(() => Promise.resolve()) }));

const push = router.push as jest.Mock;
const openWeb = openWebPage as jest.Mock;
const navigate = router.navigate as jest.Mock;
const back = router.back as jest.Mock;
const dismissAll = router.dismissAll as jest.Mock;
const canDismiss = router.canDismiss as jest.Mock;

function notification(patch: Partial<AppNotification>): AppNotification {
  return {
    id: "n-1",
    type: "approval_decided",
    title: "Your request was approved",
    body: "14 Sep to 18 Sep",
    href: "https://flexi-day.com/requests/?vacationId=v-42",
    readAt: null,
    createdAt: "2026-09-27T08:00:00.000Z",
    ...patch,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  canDismiss.mockReturnValue(false);
});

describe("openNotification", () => {
  it("marks an unread notification read and then follows its link", () => {
    const steps: string[] = [];
    const markRead = jest.fn((id: string) => steps.push(`read ${id}`));
    const follow = jest.fn(() => steps.push("follow"));

    openNotification(notification({}), { markRead, follow });

    expect(steps).toEqual(["read n-1", "follow"]);
    expect(follow).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "request", vacationId: "v-42" })
    );
  });

  it("follows a notification already read without marking it again", () => {
    const markRead = jest.fn();
    const follow = jest.fn();

    openNotification(notification({ readAt: "2026-09-27T09:00:00.000Z" }), { markRead, follow });

    expect(markRead).not.toHaveBeenCalled();
    expect(follow).toHaveBeenCalledTimes(1);
  });

  it("marks a notification with nowhere to go read and stays on the list", () => {
    const markRead = jest.fn();
    const follow = jest.fn();

    const route = openNotification(notification({ href: "/groups/" }), { markRead, follow });

    expect(route.kind).toBe("list");
    expect(markRead).toHaveBeenCalledWith("n-1");
    expect(follow).not.toHaveBeenCalled();
  });
});

describe("followNotificationRoute", () => {
  it("pushes the request detail over the list", () => {
    followNotificationRoute({
      kind: "request",
      vacationId: "v-42",
      href: { pathname: "/requests/[vacationId]", params: { vacationId: "v-42" } },
    });

    expect(push).toHaveBeenCalledWith({
      pathname: "/requests/[vacationId]",
      params: { vacationId: "v-42" },
    });
    expect(back).not.toHaveBeenCalled();
  });

  it("dismisses the list before it switches to My attendance on the linked day", () => {
    followNotificationRoute({
      kind: "attendance",
      date: "2026-09-14",
      href: { pathname: "/my-attendance", params: { date: "2026-09-14" } },
    });

    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      pathname: "/my-attendance",
      params: { date: "2026-09-14" },
    });
    expect(back.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
    expect(push).not.toHaveBeenCalled();
  });

  it("pushes the group's member list over the list", () => {
    const route = notificationRoute("/groups/detail/?groupId=g-1&tab=members");

    followNotificationRoute(route);

    expect(push).toHaveBeenCalledWith({
      pathname: "/groups/[groupId]",
      params: { groupId: "g-1" },
    });
  });

  it("opens the People card on the web in a sheet over the list", () => {
    followNotificationRoute(
      notificationRoute("/organization/?organizationId=o-1&employmentId=e-1")
    );

    expect(openWeb).toHaveBeenCalledWith("/organization/?organizationId=o-1&employmentId=e-1");
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("stays on the list for anything else", () => {
    followNotificationRoute({ kind: "list", href: "/notifications" });

    expect(back).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("openPushTap", () => {
  it("marks the tapped notification read and then follows its link", () => {
    const steps: string[] = [];
    const markRead = jest.fn((id: string) => steps.push(`read ${id}`));
    const follow = jest.fn(() => steps.push("follow"));

    openPushTap(
      { notificationId: "n-1", href: "https://flexi-day.com/requests/?vacationId=v-42" },
      { markRead, follow }
    );

    expect(steps).toEqual(["read n-1", "follow"]);
    expect(follow).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "request", vacationId: "v-42" })
    );
  });

  it("follows a push with nowhere else to go to the notification list", () => {
    const follow = jest.fn();

    const route = openPushTap(
      { notificationId: "n-2", href: null },
      { markRead: jest.fn(), follow }
    );

    expect(route.kind).toBe("list");
    expect(follow).toHaveBeenCalledWith(route);
  });

  it("follows a push that names no notification without marking anything", () => {
    const markRead = jest.fn();
    const follow = jest.fn();

    openPushTap(
      { notificationId: null, href: "/my-attendance?date=2026-10-16" },
      { markRead, follow }
    );

    expect(markRead).not.toHaveBeenCalled();
    expect(follow).toHaveBeenCalledWith(expect.objectContaining({ kind: "attendance" }));
  });
});

describe("followPushRoute", () => {
  it("pushes a request's detail over whatever is open", () => {
    const route = notificationRoute("https://flexi-day.com/requests/?vacationId=v-42");

    followPushRoute(route);

    expect(push).toHaveBeenCalledWith(route.href);
  });

  it("pushes a group's member list over whatever is open", () => {
    const route = notificationRoute("/groups/detail/?groupId=g-1&tab=members");

    followPushRoute(route);

    expect(push).toHaveBeenCalledWith({
      pathname: "/groups/[groupId]",
      params: { groupId: "g-1" },
    });
  });

  it("opens the notification list and the People card on the web over it", () => {
    followPushRoute(notificationRoute("/organization/?organizationId=o-1&employmentId=e-1"));

    expect(navigate).toHaveBeenCalledWith("/notifications");
    expect(openWeb).toHaveBeenCalledWith("/organization/?organizationId=o-1&employmentId=e-1");
  });

  it("opens the notification list for a link the phone has no screen for", () => {
    followPushRoute(notificationRoute("/groups/"));

    expect(navigate).toHaveBeenCalledWith("/notifications");
    expect(push).not.toHaveBeenCalled();
  });

  it("goes back to the shell before opening a day of My attendance, a tab of it", () => {
    canDismiss.mockReturnValue(true);
    const route = notificationRoute("/my-attendance?date=2026-10-16");

    followPushRoute(route);

    expect(dismissAll).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(route.href);
    expect(dismissAll.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]
    );
  });

  it("opens a day of My attendance straight away when the shell is on top", () => {
    const route = notificationRoute("/my-attendance?date=2026-10-16");

    followPushRoute(route);

    expect(dismissAll).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(route.href);
  });
});
