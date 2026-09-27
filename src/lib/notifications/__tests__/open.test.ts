import { router } from "expo-router";

import type { AppNotification } from "@/lib/query";

import { followNotificationRoute, openNotification } from "../open";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
}));

const push = router.push as jest.Mock;
const navigate = router.navigate as jest.Mock;
const back = router.back as jest.Mock;

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

beforeEach(() => jest.clearAllMocks());

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

  it("stays on the list for anything else", () => {
    followNotificationRoute({ kind: "list", href: "/notifications" });

    expect(back).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
