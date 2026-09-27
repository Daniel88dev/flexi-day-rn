import type { ClockView } from "@/lib/attendance/clock";
import {
  hapticForNotice,
  noticeForFailure,
  settleNotice,
  shownNotice,
} from "@/lib/attendance/notice";
import { ApiError } from "@/lib/query/failure";
import { attendance, session } from "@/test-support/attendance";

const offline = new TypeError("Network request failed");

function ready(overrides: Parameters<typeof attendance>[0] = {}, isOffline = false) {
  return {
    kind: "ready",
    state: attendance(overrides),
    offline: isOffline,
    readAt: 0,
  } satisfies ClockView;
}

describe("noticeForFailure", () => {
  it("returns a network notice that retries the same write when no answer arrived", () => {
    expect(noticeForFailure("break-start", offline)).toEqual({
      kind: "network",
      retry: "break-start",
    });
  });

  it("returns a server notice, not a network one, for a server fault", () => {
    expect(noticeForFailure("clock-out", new ApiError(503, "Unavailable"))).toEqual({
      kind: "server",
      retry: "clock-out",
    });
  });

  it.each([402, 403])("returns a refusal with the server's message for a %i", (status) => {
    const failure = new ApiError(status, "Attendance is not active for this organization");

    expect(noticeForFailure("clock-in", failure)).toEqual({
      kind: "refusal",
      message: "Attendance is not active for this organization",
    });
  });

  it("returns already open for a clock-in that lost to a session opened elsewhere", () => {
    expect(noticeForFailure("clock-in", new ApiError(409, "A session is already open"))).toEqual({
      kind: "already-open",
      message: "A session is already open",
    });
  });

  it("returns a refusal with the server's message for any other 409", () => {
    expect(noticeForFailure("break-end", new ApiError(409, "No break is running"))).toEqual({
      kind: "refusal",
      message: "No break is running",
    });
  });

  it("returns a failure without Retry for any other 4xx", () => {
    expect(noticeForFailure("clock-in", new ApiError(422, "Malformed organizationId"))).toEqual({
      kind: "failed",
      message: "Malformed organizationId",
    });
  });

  it("returns nothing for a 401, which the signed-out wipe already answers", () => {
    expect(noticeForFailure("clock-in", new ApiError(401, null))).toBeNull();
  });
});

describe("settleNotice", () => {
  it("returns the write's notice, or none, once the re-read arrived", () => {
    const refusal = { kind: "refusal", message: "No break is running" } as const;

    expect(settleNotice(refusal, { arrived: true })).toEqual(refusal);
    expect(settleNotice(null, { arrived: true })).toBeNull();
  });

  it("returns a server notice that reads again when a write landed but its re-read faulted", () => {
    const reread = { arrived: false, error: new ApiError(500, null) } as const;

    expect(settleNotice(null, reread)).toEqual({ kind: "server", retry: "reread" });
  });

  it("returns a network notice that reads again when a write landed but its re-read got no answer", () => {
    expect(settleNotice(null, { arrived: false, error: offline })).toEqual({
      kind: "network",
      retry: "reread",
    });
  });

  it("returns the re-read's failure for an already open 409 whose re-read failed", () => {
    const notice = { kind: "already-open", message: "A session is already open" } as const;
    const reread = { arrived: false, error: new ApiError(502, null) } as const;

    expect(settleNotice(notice, reread)).toEqual({ kind: "server", retry: "reread" });
  });

  it("returns a refusal as it was, since the server's message explains it without the re-read", () => {
    const refusal = { kind: "refusal", message: "Attendance is not active" } as const;

    expect(settleNotice(refusal, { arrived: false, error: offline })).toEqual(refusal);
  });
});

describe("shownNotice", () => {
  it("returns a refusal as it is while the re-read says nothing about it", () => {
    const notice = { kind: "refusal", message: "No break is running" } as const;

    expect(shownNotice(notice, ready())).toEqual(notice);
  });

  it("returns nothing for a refusal the re-read's lock notice already explains", () => {
    const notice = { kind: "refusal", message: "Attendance is not active" } as const;

    expect(shownNotice(notice, ready({ active: false }))).toBeNull();
  });

  it("returns already open with the time the re-read's open session started", () => {
    const open = session({ startedAt: "2026-09-27T06:05:00.000Z" });
    const notice = { kind: "already-open", message: "A session is already open" } as const;

    expect(shownNotice(notice, ready({ openSession: open }))).toEqual({
      kind: "already-open",
      since: "08:05",
    });
  });

  it("returns the server's refusal when the re-read shows no open session after all", () => {
    const notice = { kind: "already-open", message: "A session is already open" } as const;

    expect(shownNotice(notice, ready())).toEqual({
      kind: "refusal",
      message: "A session is already open",
    });
  });

  it("returns a network notice while the phone still reaches the server", () => {
    const notice = { kind: "network", retry: "clock-in" } as const;

    expect(shownNotice(notice, ready())).toEqual(notice);
  });

  it("returns nothing for a network notice the offline notice already explains", () => {
    const notice = { kind: "network", retry: "clock-in" } as const;

    expect(shownNotice(notice, ready({}, true))).toBeNull();
  });
});

describe("hapticForNotice", () => {
  it.each([
    { kind: "network", retry: "clock-in" },
    { kind: "server", retry: "reread" },
  ] as const)("returns error for a $kind failure", (notice) => {
    expect(hapticForNotice(notice)).toBe("error");
  });

  it.each([
    { kind: "refusal", message: null },
    { kind: "already-open", message: null },
    { kind: "failed", message: null },
  ] as const)("returns warning for a $kind", (notice) => {
    expect(hapticForNotice(notice)).toBe("warning");
  });
});
