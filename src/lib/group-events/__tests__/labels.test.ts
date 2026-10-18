import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

import { addedByLabel, lockLabel, ruleSummary, timeLabel } from "../labels";
import type { RepeatRule } from "../occurrences";

const rule = (patch: Partial<RepeatRule> & Pick<RepeatRule, "freq">): RepeatRule => ({
  interval: 1,
  weekdays: [],
  monthlyMode: null,
  until: null,
  ...patch,
});

describe("ruleSummary", () => {
  it("returns the weekly rule with its days", () => {
    expect(ruleSummary("2026-10-06", rule({ freq: "weekly", weekdays: [3, 1] }), en)).toBe(
      "Every week on Tue, Thu"
    );
    expect(
      ruleSummary(
        "2026-10-06",
        rule({ freq: "weekly", interval: 2, weekdays: [1], until: "2026-11-03" }),
        en
      )
    ).toBe("Every 2 weeks on Tue, until 3 November 2026");
  });

  it("returns Every weekday for Monday to Friday", () => {
    expect(ruleSummary("2026-10-05", rule({ freq: "weekly", weekdays: [0, 1, 2, 3, 4] }), en)).toBe(
      "Every weekday"
    );
  });

  it("returns the daily and yearly rules", () => {
    expect(ruleSummary("2026-10-01", rule({ freq: "daily", interval: 3 }), en)).toBe(
      "Every 3 days"
    );
    expect(ruleSummary("2028-02-29", rule({ freq: "yearly" }), en)).toBe(
      "Every year on 29 February"
    );
  });

  it("returns each monthly mode read off the start", () => {
    expect(ruleSummary("2027-01-31", rule({ freq: "monthly", monthlyMode: "day" }), en)).toBe(
      "Every month on day 31"
    );
    expect(ruleSummary("2026-10-13", rule({ freq: "monthly", monthlyMode: "weekday" }), en)).toBe(
      "Every month on the 2nd Tuesday"
    );
    expect(
      ruleSummary(
        "2026-10-30",
        rule({ freq: "monthly", interval: 2, monthlyMode: "lastWeekday" }),
        en
      )
    ).toBe("Every 2 months on the last Friday");
  });

  it("returns the rule in Czech", () => {
    expect(
      ruleSummary("2026-10-06", rule({ freq: "weekly", interval: 2, weekdays: [1] }), cs)
    ).toBe("Každé 2 týdny: Út");
    expect(
      ruleSummary(
        "2026-10-13",
        rule({ freq: "monthly", monthlyMode: "weekday", until: "2026-12-31" }),
        cs
      )
    ).toBe("Každý měsíc, 2. úterý, do 31. prosince 2026");
    expect(ruleSummary("2028-02-29", rule({ freq: "yearly", interval: 5 }), cs)).toBe(
      "Každých 5 let, 29. února"
    );
  });
});

describe("timeLabel", () => {
  const event = {
    startDate: "2026-10-21",
    endDate: "2026-10-21",
    startTime: "09:30",
    endTime: "09:45",
  };

  it("returns the times of a single day, or All day", () => {
    expect(timeLabel(event, en)).toBe("09:30–09:45");
    expect(timeLabel({ ...event, startTime: null, endTime: null }, cs)).toBe("Celý den");
  });

  it("returns the dates of a multi-day occurrence", () => {
    expect(timeLabel({ ...event, endDate: "2026-10-23", startTime: null, endTime: null }, en)).toBe(
      "Wed 21 Oct – Fri 23 Oct · All day"
    );
    expect(timeLabel({ ...event, endDate: "2026-10-22", endTime: "17:00" }, en)).toBe(
      "Wed 21 Oct 09:30 – Thu 22 Oct 17:00"
    );
  });
});

describe("addedByLabel", () => {
  it("returns who added the event, the viewer as you, a deleted account as a former member", () => {
    const creator = { id: "eva", name: "Eva Novak" };
    expect(addedByLabel(creator, "me", en)).toBe("Added by Eva Novak");
    expect(addedByLabel({ ...creator, id: "me" }, "me", en)).toBe("Added by you");
    expect(addedByLabel(null, "me", en)).toBe("Added by a former member");
  });
});

describe("lockLabel", () => {
  it("returns the creator's first name, or only the admins once their account is gone", () => {
    expect(lockLabel({ id: "eva", name: "Eva Novak" }, en)).toBe(
      "Only Eva or a group admin can change this"
    );
    expect(lockLabel(null, cs)).toBe("Změnit ji může jen správce skupiny");
  });
});
