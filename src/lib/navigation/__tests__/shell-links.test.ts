import { en } from "@/i18n/en";
import { buildSections, buildUtilityLinks, splitForTabBar } from "@/lib/navigation/shell-links";

describe("buildSections", () => {
  it("returns time off and attendance for a plain member", () => {
    const sections = buildSections(en, { administersSomething: false });
    expect(sections.map((section) => section.id)).toEqual(["timeOff", "attendance"]);
  });

  it("adds the organization section and team attendance for an admin", () => {
    const sections = buildSections(en, { administersSomething: true });
    expect(sections.map((section) => section.id)).toEqual([
      "timeOff",
      "attendance",
      "organization",
    ]);
    const attendance = sections.find((section) => section.id === "attendance");
    expect(attendance?.links.map((link) => link.key)).toEqual(["myAttendance", "teamAttendance"]);
  });

  it("gives every link a route", () => {
    const links = buildSections(en, { administersSomething: true }).flatMap(
      (section) => section.links
    );
    expect(links.every((link) => link.href.startsWith("/"))).toBe(true);
  });
});

describe("buildUtilityLinks", () => {
  it("returns settings", () => {
    expect(buildUtilityLinks(en).map((link) => link.key)).toEqual(["settings"]);
  });
});

describe("splitForTabBar", () => {
  it("puts the first two time off links and the first attendance link on the bar", () => {
    const { bar } = splitForTabBar(buildSections(en, { administersSomething: false }));
    expect(bar.map((link) => link.key)).toEqual(["dashboard", "requests", "myAttendance"]);
  });

  it("leaves everything else in its section for the sheet", () => {
    const { sheet } = splitForTabBar(buildSections(en, { administersSomething: false }));
    expect(sheet.map((section) => section.links.map((link) => link.key))).toEqual([
      ["report", "groups", "calendarSync"],
    ]);
  });

  it("drops a section the bar emptied", () => {
    const { sheet } = splitForTabBar([
      {
        id: "attendance",
        label: "Attendance",
        links: [{ key: "myAttendance", label: "My attendance", icon: () => null, href: "/a" }],
      },
    ] as never);
    expect(sheet).toEqual([]);
  });
});
