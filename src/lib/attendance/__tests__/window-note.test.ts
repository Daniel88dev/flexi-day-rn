import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import { entryWindowHint, windowNote, windowNoteText } from "../window-note";

const TODAY = "2026-09-11";

const note = (
  window: { enabled: boolean; days: number | null } | undefined,
  businessDate: string,
  options: { active?: boolean; employmentEnded?: boolean } = {}
) =>
  windowNote({
    window,
    businessDate,
    today: TODAY,
    active: options.active ?? true,
    employmentEnded: options.employmentEnded ?? false,
  });

describe("windowNote", () => {
  it("returns a hint while the day can be edited", () => {
    expect(note({ enabled: true, days: 7 }, "2026-09-04")).toEqual({
      kind: "hint",
      mode: "DAYS",
      days: 7,
    });
    expect(note({ enabled: true, days: 0 }, TODAY)).toEqual({
      kind: "hint",
      mode: "TODAY",
      days: 0,
    });
    expect(note({ enabled: true, days: null }, "2025-01-02")).toEqual({
      kind: "hint",
      mode: "NO_LIMIT",
      days: 0,
    });
  });

  it("returns the lock for a day before the window", () => {
    expect(note({ enabled: true, days: 7 }, "2026-09-03")).toEqual({
      kind: "lock",
      cause: "OUTSIDE",
      mode: "DAYS",
      days: 7,
    });
  });

  it("returns the lock with the window off, today included", () => {
    expect(note({ enabled: false, days: 7 }, TODAY)).toEqual({
      kind: "lock",
      cause: "OFF",
      mode: "OFF",
      days: 7,
    });
  });

  it("returns the lock for an ended employment whatever the setting", () => {
    expect(note({ enabled: true, days: null }, TODAY, { employmentEnded: true })).toMatchObject({
      kind: "lock",
      cause: "ENDED",
    });
  });

  it("returns nothing while the plan has lapsed or attendance is off", () => {
    expect(note({ enabled: true, days: 7 }, TODAY, { active: false })).toBeNull();
    expect(note({ enabled: false, days: 7 }, TODAY, { active: false })).toBeNull();
  });

  it("returns nothing when the backend names no window", () => {
    expect(note(undefined, TODAY)).toBeNull();
  });
});

describe("entryWindowHint", () => {
  it("returns how far back the window reaches, in the entry sheet's words", () => {
    expect(entryWindowHint({ enabled: true, days: 0 }, en)).toBe("Today");
    expect(entryWindowHint({ enabled: true, days: 1 }, en)).toBe("Today or up to 1 day back");
    expect(entryWindowHint({ enabled: true, days: 7 }, en)).toBe("Today or up to 7 days back");
    expect(entryWindowHint({ enabled: true, days: null }, en)).toBe("Any day of your employment");
    expect(entryWindowHint({ enabled: true, days: 3 }, cs)).toBe("Dnes nebo až 3 dny zpátky");
  });
});

describe("windowNoteText", () => {
  it("returns the web's hint for each mode", () => {
    expect(windowNoteText({ kind: "hint", mode: "DAYS", days: 1 }, en)).toBe(
      "You can enter and correct your attendance for today and the 1 day before it. Earlier days go through your admin."
    );
    expect(windowNoteText({ kind: "hint", mode: "TODAY", days: 0 }, en)).toBe(
      en.selfService.windowZeroHint
    );
    expect(windowNoteText({ kind: "hint", mode: "NO_LIMIT", days: 0 }, en)).toBe(
      "You can enter and correct any day of your own employment."
    );
  });

  it("returns the lock notice for each cause", () => {
    expect(windowNoteText({ kind: "lock", cause: "OFF", mode: "OFF", days: 0 }, en)).toBe(
      en.selfService.windowOffNotice
    );
    expect(windowNoteText({ kind: "lock", cause: "ENDED", mode: "DAYS", days: 3 }, en)).toBe(
      en.selfService.windowEndedNotice
    );
    expect(windowNoteText({ kind: "lock", cause: "OUTSIDE", mode: "DAYS", days: 7 }, en)).toBe(
      "Only an admin can change a day this old. You can enter and correct today and the 7 days before it. For anything earlier, ask a group admin or an organization admin."
    );
    expect(windowNoteText({ kind: "lock", cause: "OUTSIDE", mode: "TODAY", days: 0 }, en)).toBe(
      en.selfService.windowOutsideZeroNotice
    );
  });

  it("declines the Czech days", () => {
    expect(windowNoteText({ kind: "hint", mode: "DAYS", days: 1 }, cs)).toContain("1 den");
    expect(windowNoteText({ kind: "hint", mode: "DAYS", days: 3 }, cs)).toContain("3 dny");
    expect(windowNoteText({ kind: "hint", mode: "DAYS", days: 7 }, cs)).toContain("7 dní");
  });
});
