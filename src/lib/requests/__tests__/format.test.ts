import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import { dayLengthLabel, requestLengthLabel, runDatesLabel } from "../format";

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

const FULL = { halfDay: false, startTime: null, endTime: null };
const HALF = { halfDay: true, startTime: null, endTime: null };
const labelsOf = (dictionary: typeof en) => ({
  ...dictionary.common,
  dayCount: dictionary.requests.dayCount,
  workingDayCount: dictionary.requests.workingDayCount,
});

describe("requestLengthLabel", () => {
  it("returns the length and the working days of a full-day Request", () => {
    expect(requestLengthLabel(FULL, 7, labelsOf(en))).toBe("Full day · 7 working days");
    expect(requestLengthLabel(FULL, 1, labelsOf(en))).toBe("Full day · 1 working day");
  });

  it("returns half days as whole days, never a fraction", () => {
    expect(requestLengthLabel(HALF, 3, labelsOf(en))).toBe("Half day · 3 days");
  });

  it("returns only half day for a single half day", () => {
    expect(requestLengthLabel(HALF, 1, labelsOf(en))).toBe("Half day");
  });

  it("returns the times in place of full day", () => {
    expect(
      requestLengthLabel({ halfDay: false, startTime: "08:00", endTime: "12:00" }, 2, labelsOf(en))
    ).toBe("08:00-12:00 · 2 working days");
  });

  it("returns Czech plurals", () => {
    expect(requestLengthLabel(FULL, 1, labelsOf(cs))).toBe("Celý den · 1 pracovní den");
    expect(requestLengthLabel(FULL, 3, labelsOf(cs))).toBe("Celý den · 3 pracovní dny");
    expect(requestLengthLabel(FULL, 7, labelsOf(cs))).toBe("Celý den · 7 pracovních dní");
    expect(requestLengthLabel(HALF, 2, labelsOf(cs))).toBe("Půlden · 2 dny");
    expect(requestLengthLabel(HALF, 1, labelsOf(cs))).toBe("Půlden");
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
