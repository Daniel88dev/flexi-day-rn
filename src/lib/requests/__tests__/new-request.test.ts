import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import type { WriteFailure } from "@/lib/local-store";
import type { GroupMember } from "@/lib/query";

import {
  bookableMembers,
  bookableWindow,
  canSubmit,
  clampDay,
  newRequestDraft,
  newRequestValues,
  offersHalfDay,
  openingRange,
  shownType,
  submitFailureMessage,
  withFrom,
  type NewRequestValues,
} from "../new-request";

const TODAY = new Date(2026, 8, 27, 10, 30);

describe("bookableWindow", () => {
  it("returns this year's first day through the last day of next year", () => {
    expect(bookableWindow(TODAY)).toEqual({ min: "2026-01-01", max: "2027-12-31" });
  });
});

describe("clampDay", () => {
  const window = bookableWindow(TODAY);

  it("returns a day inside the window as it is", () => {
    expect(clampDay("2026-10-05", window)).toBe("2026-10-05");
  });

  it("returns the window's edge for a day outside it", () => {
    expect(clampDay("2025-12-31", window)).toBe("2026-01-01");
    expect(clampDay("2028-01-01", window)).toBe("2027-12-31");
  });
});

describe("openingRange", () => {
  it("returns the one day the form was opened for when no end day was passed", () => {
    expect(openingRange("2026-10-05", undefined, TODAY)).toEqual({
      from: "2026-10-05",
      to: "2026-10-05",
    });
  });

  it("returns today when the day passed is not a day", () => {
    const today = { from: "2026-09-27", to: "2026-09-27" };
    expect(openingRange("tomorrow", undefined, TODAY)).toEqual(today);
    expect(openingRange("2026-02-31", undefined, TODAY)).toEqual(today);
  });

  it("returns a day before the window as its first day, so the pickers stay in range", () => {
    expect(openingRange("2025-11-03", undefined, TODAY)).toEqual({
      from: "2026-01-01",
      to: "2026-01-01",
    });
  });

  it("returns From and To from the day and the inclusive end day the form was opened for", () => {
    expect(openingRange("2026-10-12", "2026-10-16", TODAY)).toEqual({
      from: "2026-10-12",
      to: "2026-10-16",
    });
  });

  it("returns To on From when the end day is missing, not a day, or before From", () => {
    const oneDay = { from: "2026-10-12", to: "2026-10-12" };
    expect(openingRange("2026-10-12", undefined, TODAY)).toEqual(oneDay);
    expect(openingRange("2026-10-12", "friday", TODAY)).toEqual(oneDay);
    expect(openingRange("2026-10-12", "2026-02-31", TODAY)).toEqual(oneDay);
    expect(openingRange("2026-10-12", "2026-10-11", TODAY)).toEqual(oneDay);
  });

  it("returns an end day past the window as the window's last day", () => {
    expect(openingRange("2027-12-20", "2028-01-05", TODAY)).toEqual({
      from: "2027-12-20",
      to: "2027-12-31",
    });
  });

  it("returns today for both when neither day was passed", () => {
    expect(openingRange(undefined, undefined, TODAY)).toEqual({
      from: "2026-09-27",
      to: "2026-09-27",
    });
  });
});

const VALUES: NewRequestValues = newRequestValues("2026-10-05");

describe("newRequestValues", () => {
  it("returns a one-day Vacation for the viewer on the day given, with no group picked yet", () => {
    expect(VALUES).toEqual({
      groupId: null,
      memberId: null,
      autoApprove: true,
      vacationType: "VACATION",
      from: "2026-10-05",
      to: "2026-10-05",
      startTime: "",
      endTime: "",
      halfDay: false,
      note: "",
    });
  });

  it("returns From and To spanning the range given", () => {
    expect(newRequestValues("2026-10-12", "2026-10-16")).toMatchObject({
      from: "2026-10-12",
      to: "2026-10-16",
    });
  });
});

describe("withFrom", () => {
  it("returns To dragged along when From moves past it", () => {
    expect(withFrom({ ...VALUES, to: "2026-10-07" }, "2026-10-09")).toMatchObject({
      from: "2026-10-09",
      to: "2026-10-09",
    });
  });

  it("returns To where it was when From stays on or before it", () => {
    expect(withFrom({ ...VALUES, to: "2026-10-07" }, "2026-10-06")).toMatchObject({
      from: "2026-10-06",
      to: "2026-10-07",
    });
  });
});

describe("offersHalfDay", () => {
  it("returns true only for a single day", () => {
    expect(offersHalfDay(VALUES)).toBe(true);
    expect(offersHalfDay({ ...VALUES, to: "2026-10-06" })).toBe(false);
  });
});

describe("shownType", () => {
  it("returns Vacation in place of a Sick day the group no longer offers", () => {
    expect(shownType("SICK_DAY", { offerSickDay: false })).toBe("VACATION");
    expect(shownType("SICK_DAY", { offerSickDay: true })).toBe("SICK_DAY");
    expect(shownType("OTHER", { offerSickDay: false })).toBe("OTHER");
  });
});

describe("canSubmit", () => {
  const ready = { ...VALUES, groupId: "group-1" };
  const offer = { offerSickDay: false };

  it("returns true for a group, a type and a range", () => {
    expect(canSubmit(ready, offer)).toBe(true);
  });

  it("returns false until a group is picked", () => {
    expect(canSubmit(VALUES, offer)).toBe(false);
  });

  it("returns false while Others is open with no type picked", () => {
    expect(canSubmit({ ...ready, vacationType: null }, offer)).toBe(false);
  });

  it("returns false for Other without a note", () => {
    expect(canSubmit({ ...ready, vacationType: "OTHER", note: "  " }, offer)).toBe(false);
    expect(canSubmit({ ...ready, vacationType: "OTHER", note: "Moving house" }, offer)).toBe(true);
  });

  it("returns false for a range that ends before it starts", () => {
    expect(canSubmit({ ...ready, to: "2026-10-04" }, offer)).toBe(false);
  });

  it("leaves the times to the server, as the web does", () => {
    expect(canSubmit({ ...ready, startTime: "13:00", endTime: "12:00" }, offer)).toBe(true);
  });
});

describe("newRequestDraft", () => {
  const ready = { ...VALUES, groupId: "group-1" };

  it("returns the create body for the viewer's own booking", () => {
    expect(
      newRequestDraft(
        { ...ready, to: "2026-10-07", note: "  Trip  " },
        { canAdmin: false, offerSickDay: false }
      )
    ).toEqual({
      groupId: "group-1",
      from: "2026-10-05",
      to: "2026-10-07",
      vacationType: "VACATION",
      startTime: null,
      endTime: null,
      halfDay: false,
      note: "Trip",
    });
  });

  it("returns the times and half day of a single day", () => {
    expect(
      newRequestDraft(
        { ...ready, startTime: "08:00", endTime: "12:00", halfDay: true },
        { canAdmin: false, offerSickDay: false }
      )
    ).toMatchObject({ startTime: "08:00", endTime: "12:00", halfDay: true, note: null });
  });

  it("returns no half day for a range, whatever the switch said on a single day", () => {
    expect(
      newRequestDraft(
        { ...ready, halfDay: true, to: "2026-10-06" },
        { canAdmin: false, offerSickDay: false }
      ).halfDay
    ).toBe(false);
  });

  it("returns the member and approve-immediately for an admin booking on someone's behalf", () => {
    expect(
      newRequestDraft(
        { ...ready, memberId: "user-2", autoApprove: false },
        { canAdmin: true, offerSickDay: false }
      )
    ).toMatchObject({ userId: "user-2", autoApprove: false });
  });

  it("returns no member once the group says the viewer is not its admin", () => {
    const draft = newRequestDraft(
      { ...ready, memberId: "user-2" },
      { canAdmin: false, offerSickDay: false }
    );
    expect(draft).not.toHaveProperty("userId");
    expect(draft).not.toHaveProperty("autoApprove");
  });

  it("returns Vacation for a Sick day the group does not offer", () => {
    expect(
      newRequestDraft(
        { ...ready, vacationType: "SICK_DAY" },
        { canAdmin: false, offerSickDay: false }
      ).vacationType
    ).toBe("VACATION");
  });
});

describe("submitFailureMessage", () => {
  const rejected = (
    status: number,
    message: string | null,
    context?: Record<string, unknown>
  ): WriteFailure => ({ ok: false, reason: "rejected", status, message, context });

  it("returns the unreachable copy, which says the entry is kept for another Submit", () => {
    expect(submitFailureMessage({ ok: false, reason: "unreachable", message: null }, en)).toBe(
      en.newRequest.unreachable
    );
  });

  it("returns a 409's conflicting days in the phone's own day format", () => {
    expect(
      submitFailureMessage(
        rejected(409, "One or more days in the requested range are already booked", {
          conflictingDays: ["2026-09-21", "2026-10-02"],
        }),
        en
      )
    ).toBe(en.newRequest.conflict("21 Sep, 2 Oct"));
  });

  it("returns the server's words for a 409 that listed no days, and the generic copy for none", () => {
    expect(submitFailureMessage(rejected(409, "Already booked", { conflictingDays: [] }), en)).toBe(
      "Already booked"
    );
    expect(submitFailureMessage(rejected(409, null), en)).toBe(en.newRequest.conflictGeneric);
  });

  it("returns a 402 translated the way the web does: read-only group, or the member limit", () => {
    expect(
      submitFailureMessage(
        rejected(402, "Group is read-only", { reason: "READ_ONLY", limit: 5, current: 7 }),
        cs
      )
    ).toBe(cs.newRequest.readOnlyGroup);
    expect(
      submitFailureMessage(
        rejected(402, "Plan limit", { reason: "PLAN_LIMIT", limit: 5, current: 5 }),
        en
      )
    ).toBe(en.newRequest.memberLimitReached(5));
  });

  it("returns the server's words for a 402 without a plan reason", () => {
    expect(submitFailureMessage(rejected(402, "Payment required"), en)).toBe("Payment required");
  });

  it("returns the server's words for any other refusal, else the generic failure", () => {
    expect(submitFailureMessage(rejected(422, "Allowance exceeded"), en)).toBe(
      "Allowance exceeded"
    );
    expect(submitFailureMessage(rejected(500, null), en)).toBe(en.newRequest.createFailed);
  });
});

describe("bookableMembers", () => {
  const member = (patch: Partial<GroupMember>): GroupMember => ({
    userId: "user-2",
    controlledUser: true,
    deletedAt: null,
    user: { id: "user-2", name: "Eva Horáková", initials: "EH", avatarColor: "hsl(0 0% 50%)" },
    ...patch,
  });

  it("returns the live members the admin controls, never the admin", () => {
    const eva = member({});
    const left = member({ userId: "user-3", deletedAt: "2026-09-01T00:00:00.000Z" });
    const outside = member({ userId: "user-4", controlledUser: false });
    const admin = member({ userId: "user-9" });

    expect(bookableMembers([eva, left, outside, admin], "user-9")).toEqual([eva]);
  });

  it("returns nobody while the viewer is not known, so the admin cannot pick themselves", () => {
    expect(bookableMembers([member({})], null)).toEqual([]);
  });
});
