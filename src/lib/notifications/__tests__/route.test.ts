import { notificationRoute } from "../route";

const LIST = { kind: "list", href: "/notifications" };

function request(vacationId: string) {
  return {
    kind: "request",
    vacationId,
    href: { pathname: "/requests/[vacationId]", params: { vacationId } },
  };
}

function attendance(date: string) {
  return {
    kind: "attendance",
    date,
    href: { pathname: "/my-attendance", params: { date } },
  };
}

function group(groupId: string) {
  return {
    kind: "group",
    groupId,
    href: { pathname: "/groups/[groupId]", params: { groupId } },
  };
}

describe("notificationRoute", () => {
  it("returns the group's member list for a manager's account deleted link", () => {
    expect(notificationRoute("/groups/detail/?groupId=g-1&tab=members")).toEqual(group("g-1"));
    expect(notificationRoute("https://flexi-day.com/groups/detail?groupId=g%2D2")).toEqual(
      group("g-2")
    );
  });

  it("hands an admin's People card link to the web, where the card lives", () => {
    expect(notificationRoute("/organization/?organizationId=o-1&employmentId=e-1")).toEqual({
      kind: "web",
      path: "/organization/?organizationId=o-1&employmentId=e-1",
      href: "/notifications",
    });
  });

  it("returns the list for a group or organization link without its id", () => {
    expect(notificationRoute("/groups/detail/?tab=members")).toEqual(LIST);
    expect(notificationRoute("/organization/")).toEqual(LIST);
  });

  it("returns the request detail for the backend's absolute request link", () => {
    expect(notificationRoute("https://flexi-day.com/requests/?vacationId=v-42")).toEqual(
      request("v-42")
    );
  });

  it("returns the request detail whatever host the link names", () => {
    expect(notificationRoute("https://preview.flexi-day.dev/requests/?vacationId=v-42")).toEqual(
      request("v-42")
    );
  });

  it("returns My attendance on the day for the session auto-closed link", () => {
    expect(notificationRoute("/my-attendance/?date=2026-09-14")).toEqual(attendance("2026-09-14"));
  });

  it("returns the same route with or without the trailing slash", () => {
    expect(notificationRoute("/requests?vacationId=v-1")).toEqual(request("v-1"));
    expect(notificationRoute("/requests//?vacationId=v-1")).toEqual(request("v-1"));
    expect(notificationRoute("https://flexi-day.com/my-attendance?date=2026-09-14")).toEqual(
      attendance("2026-09-14")
    );
  });

  it("returns the route whatever other params and fragment the link carries", () => {
    expect(
      notificationRoute("https://flexi-day.com/requests/?tab=all&vacationId=v-7&utm=mail#top")
    ).toEqual(request("v-7"));
    expect(notificationRoute("/my-attendance/?view=week&date=2026-09-14#day")).toEqual(
      attendance("2026-09-14")
    );
  });

  it("returns the first vacationId when the link repeats it", () => {
    expect(notificationRoute("/requests/?vacationId=v-1&vacationId=v-2")).toEqual(request("v-1"));
  });

  it("returns a decoded vacationId", () => {
    expect(notificationRoute("/requests/?vacationId=v%2D9")).toEqual(request("v-9"));
  });

  it("returns the list for a missing link", () => {
    expect(notificationRoute(null)).toEqual(LIST);
    expect(notificationRoute(undefined)).toEqual(LIST);
    expect(notificationRoute("")).toEqual(LIST);
  });

  it("returns the list for a page the phone has no screen for", () => {
    expect(notificationRoute("https://flexi-day.com/groups/?groupId=g-1")).toEqual(LIST);
    expect(notificationRoute("/settings/?groupId=g-1")).toEqual(LIST);
    expect(notificationRoute("/dashboard/")).toEqual(LIST);
    expect(notificationRoute("/requests/new/?vacationId=v-1")).toEqual(LIST);
  });

  it("returns the list for a request link without a vacation", () => {
    expect(notificationRoute("/requests/")).toEqual(LIST);
    expect(notificationRoute("/requests/?vacationId=")).toEqual(LIST);
    expect(notificationRoute("/requests/?vacationid=v-1")).toEqual(LIST);
  });

  it("returns the list for a My attendance link without a well-formed day", () => {
    expect(notificationRoute("/my-attendance/")).toEqual(LIST);
    expect(notificationRoute("/my-attendance/?date=")).toEqual(LIST);
    expect(notificationRoute("/my-attendance/?date=14.9.2026")).toEqual(LIST);
    expect(notificationRoute("/my-attendance/?date=2026-09-14T00:00")).toEqual(LIST);
  });

  it("returns the list for a malformed link", () => {
    expect(notificationRoute("/requests/?vacationId=%E0%A4%A")).toEqual(LIST);
    expect(notificationRoute("not a link")).toEqual(LIST);
    expect(notificationRoute("?vacationId=v-1")).toEqual(LIST);
    expect(notificationRoute("mailto:someone@example.com")).toEqual(LIST);
  });
});
