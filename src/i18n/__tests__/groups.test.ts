import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

describe("groups.facts.workingDaysPhrase", () => {
  it("returns a working week as one range", () => {
    expect(en.groups.facts.workingDaysPhrase([{ from: 0, to: 4 }])).toBe("Mon to Fri");
    expect(cs.groups.facts.workingDaysPhrase([{ from: 0, to: 4 }])).toBe("Po až Pá");
  });

  it("returns single days and two-day runs as a list", () => {
    const runs = [
      { from: 0, to: 0 },
      { from: 2, to: 3 },
      { from: 5, to: 6 },
    ];
    expect(en.groups.facts.workingDaysPhrase(runs)).toBe("Mon, Wed, Thu, Sat, Sun");
    expect(cs.groups.facts.workingDaysPhrase(runs)).toBe("Po, St, Čt, So, Ne");
  });

  it("returns none for no working days", () => {
    expect(en.groups.facts.workingDaysPhrase([])).toBe("None");
    expect(cs.groups.facts.workingDaysPhrase([])).toBe("Žádné");
  });
});

describe("groups.defaultsLine", () => {
  it("returns one vacation day in the singular", () => {
    expect(en.groups.defaultsLine(1, 0)).toBe("1 vacation day · 0 home office");
    expect(en.groups.defaultsLine(20, 0)).toBe("20 vacation days · 0 home office");
  });

  it("returns the Czech plural of days", () => {
    expect(cs.groups.defaultsLine(1, 0)).toBe("1 den dovolené · 0 home office");
    expect(cs.groups.defaultsLine(3, 2)).toBe("3 dny dovolené · 2 home office");
    expect(cs.groups.defaultsLine(20, 0)).toBe("20 dní dovolené · 0 home office");
  });
});

describe("groups.facts.weekdayInitials", () => {
  it("returns seven initials from Monday in both languages", () => {
    expect(en.groups.facts.weekdayInitials).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(cs.groups.facts.weekdayInitials).toEqual(["P", "Ú", "S", "Č", "P", "S", "N"]);
  });
});

describe("groups.members.heading", () => {
  it("returns one person in the singular", () => {
    expect(en.groups.members.heading(1)).toBe("1 person");
    expect(en.groups.members.heading(4)).toBe("4 people");
    expect(en.groups.members.heading(0)).toBe("0 people");
  });

  it("returns the three Czech plural forms", () => {
    expect(cs.groups.members.heading(1)).toBe("1 člověk");
    expect(cs.groups.members.heading(2)).toBe("2 lidé");
    expect(cs.groups.members.heading(4)).toBe("4 lidé");
    expect(cs.groups.members.heading(5)).toBe("5 lidí");
    expect(cs.groups.members.heading(0)).toBe("0 lidí");
  });
});

describe("groups.quotas.heading", () => {
  it("returns the year's allowance in both languages", () => {
    expect(en.groups.quotas.heading(2026)).toBe("Allowance 2026");
    expect(cs.groups.quotas.heading(2026)).toBe("Nárok 2026");
  });
});

describe("groups.offlineUpdated", () => {
  it("returns when the kept data was read", () => {
    expect(en.groups.offlineUpdated("09:41")).toBe("Offline, updated 09:41");
    expect(cs.groups.offlineUpdated("09:41")).toBe("Offline, aktualizováno 09:41");
  });
});

describe("groups.administered.memberCount", () => {
  it("returns one member in the singular", () => {
    expect(en.groups.administered.memberCount(1)).toBe("1 member");
    expect(en.groups.administered.memberCount(3)).toBe("3 members");
  });

  it("returns the three Czech plural forms", () => {
    expect(cs.groups.administered.memberCount(1)).toBe("1 člen");
    expect(cs.groups.administered.memberCount(2)).toBe("2 členové");
    expect(cs.groups.administered.memberCount(4)).toBe("4 členové");
    expect(cs.groups.administered.memberCount(5)).toBe("5 členů");
    expect(cs.groups.administered.memberCount(0)).toBe("0 členů");
  });
});

describe("groups.orgAdminNotice", () => {
  it("returns the web's wording with the organization's name", () => {
    expect(en.groups.orgAdminNotice("Olivia Owner")).toBe(
      "You're managing this group as an administrator of Olivia Owner. You're not a member of it, so you can't book or approve leave here."
    );
    expect(cs.groups.orgAdminNotice("Olivia Owner")).toBe(
      "Tuto skupinu spravujete jako správce organizace Olivia Owner. Nejste jejím členem, takže si zde nemůžete brát ani schvalovat volno."
    );
  });
});
