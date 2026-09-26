import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import { dayLengthLabel, runDatesLabel } from "../format";

const LABELS = { halfDay: "Half day", fullDay: "Full day" };

describe("dayLengthLabel", () => {
  it("returns full day for a day with no times", () => {
    expect(dayLengthLabel({ halfDay: false, startTime: null, endTime: null }, LABELS)).toBe(
      "Full day"
    );
  });

  it("returns half day for a half day with no times", () => {
    expect(dayLengthLabel({ halfDay: true, startTime: null, endTime: null }, LABELS)).toBe(
      "Half day"
    );
  });

  it("returns the times, to the minute, for a full day that carries them", () => {
    expect(
      dayLengthLabel({ halfDay: false, startTime: "08:00:00", endTime: "12:30:00" }, LABELS)
    ).toBe("08:00-12:30");
  });

  it("returns half day and the times for a half day that carries them", () => {
    expect(dayLengthLabel({ halfDay: true, startTime: "13:00", endTime: "17:00" }, LABELS)).toBe(
      "Half day · 13:00-17:00"
    );
  });
});

describe("runDatesLabel", () => {
  it("returns one day for a single-day run", () => {
    expect(runDatesLabel({ from: "2026-09-21", to: "2026-09-21" }, en.requests.runDates)).toBe(
      "21 Sep"
    );
  });

  it("returns the day span inside one month", () => {
    expect(runDatesLabel({ from: "2026-09-21", to: "2026-09-23" }, en.requests.runDates)).toBe(
      "21-23 Sep"
    );
  });

  it("returns both months for a span across them", () => {
    expect(runDatesLabel({ from: "2026-09-30", to: "2026-10-02" }, en.requests.runDates)).toBe(
      "30 Sep - 2 Oct"
    );
  });

  it("returns Czech day and month numbers", () => {
    expect(runDatesLabel({ from: "2026-09-21", to: "2026-09-23" }, cs.requests.runDates)).toBe(
      "21.-23. 9."
    );
  });
});
