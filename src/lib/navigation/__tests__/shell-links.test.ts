import { en } from "@/i18n/en";
import { attendance, session } from "@/test-support/attendance";
import {
  attendanceLinkShown,
  buildSections,
  buildUtilityLinks,
  splitForTabBar,
} from "@/lib/navigation/shell-links";

describe("buildSections", () => {
  it("returns time off and attendance", () => {
    const sections = buildSections(en);
    expect(sections.map((section) => section.id)).toEqual(["timeOff", "attendance"]);
  });

  it("returns none of the web's admin pages, which the phone does not have", () => {
    const keys = buildSections(en).flatMap((section) => section.links.map((link) => link.key));
    expect(keys).toEqual(["dashboard", "requests", "report", "groups", "myAttendance"]);
  });

  it("returns the My attendance link hidden when it is not shown", () => {
    const links = buildSections(en, { attendanceLink: false }).flatMap((section) => section.links);
    expect(links.find((link) => link.key === "myAttendance")?.hidden).toBe(true);
  });

  it("gives every link a route", () => {
    const links = buildSections(en).flatMap((section) => section.links);
    expect(links.every((link) => link.href.startsWith("/"))).toBe(true);
  });
});

describe("buildSections with the directory", () => {
  const withDirectory = (readOnly: boolean) =>
    buildSections(en, { attendanceLink: true, directory: { shown: true, readOnly } });

  it("returns a People section with one Directory row for a viewer in a directory organization", () => {
    const people = withDirectory(false).find((section) => section.id === "people");
    expect(people?.label).toBe("People");
    expect(people?.links).toEqual([
      expect.objectContaining({ key: "directory", label: "Directory", href: "/directory" }),
    ]);
    expect(people?.links[0]?.chip).toBeUndefined();
  });

  it("returns no People section for anyone else, with no upsell", () => {
    const ids = (directory?: { shown: boolean; readOnly: boolean }) =>
      buildSections(en, { attendanceLink: true, directory }).map((section) => section.id);
    expect(ids()).toEqual(["timeOff", "attendance"]);
    expect(ids({ shown: false, readOnly: false })).toEqual(["timeOff", "attendance"]);
  });

  it("returns the read only chip on the Directory row once the directory has lapsed", () => {
    const people = withDirectory(true).find((section) => section.id === "people");
    expect(people?.links[0]?.chip).toBe("read only");
  });

  it("keeps the Directory row in the sheet, never on the bar", () => {
    const { bar, sheet } = splitForTabBar(withDirectory(false));
    expect(bar.map((link) => link.key)).not.toContain("directory");
    expect(sheet.map((section) => section.id)).toEqual(["timeOff", "people"]);
  });
});

describe("buildUtilityLinks", () => {
  it("returns settings", () => {
    expect(buildUtilityLinks(en).map((link) => link.key)).toEqual(["settings"]);
  });
});

describe("splitForTabBar", () => {
  it("puts the first two time off links and the first attendance link on the bar", () => {
    const { bar } = splitForTabBar(buildSections(en));
    expect(bar.map((link) => link.key)).toEqual(["dashboard", "requests", "myAttendance"]);
  });

  it("leaves everything else in its section for the sheet", () => {
    const { sheet } = splitForTabBar(buildSections(en));
    expect(sheet.map((section) => section.links.map((link) => link.key))).toEqual([
      ["report", "groups"],
    ]);
  });

  it("puts Report in the attendance slot when there is no attendance link", () => {
    const { bar, sheet } = splitForTabBar(buildSections(en, { attendanceLink: false }));
    expect(bar.map((link) => link.key)).toEqual(["dashboard", "requests", "report"]);
    expect(sheet.map((section) => section.links.map((link) => link.key))).toEqual([["groups"]]);
  });

  it("puts Report on the bar as its tab route, not the page pushed over the shell", () => {
    const { bar } = splitForTabBar(buildSections(en, { attendanceLink: false }));
    expect(bar[2]).toMatchObject({ key: "report", href: "/report-tab", tab: true });
  });

  it("keeps Report in the sheet as the page pushed over the shell", () => {
    const { sheet } = splitForTabBar(buildSections(en));
    const report = sheet[0].links.find((link) => link.key === "report");
    expect(report?.href).toBe("/report");
    expect(report?.tab).toBeUndefined();
  });

  it("returns the tab routes the bar leaves off, so the layout keeps them reachable", () => {
    const shown = splitForTabBar(buildSections(en)).hiddenTabs;
    expect(shown.map((link) => [link.key, link.href])).toEqual([["report", "/report-tab"]]);
    const { hiddenTabs } = splitForTabBar(buildSections(en, { attendanceLink: false }));
    expect(hiddenTabs.map((link) => link.key)).toEqual(["myAttendance"]);
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

describe("attendanceLinkShown", () => {
  const ready = (overrides: Parameters<typeof attendance>[0]) =>
    ({ kind: "ready", state: attendance(overrides), offline: false, readAt: 0 }) as const;

  it("returns true while attendance is active", () => {
    expect(attendanceLinkShown(ready({ active: true }))).toBe(true);
  });

  it("returns true for a lapsed organization while a session is still open", () => {
    expect(attendanceLinkShown(ready({ active: false, openSession: session() }))).toBe(true);
  });

  it("returns false for a lapsed organization with nothing open", () => {
    expect(attendanceLinkShown(ready({ active: false }))).toBe(false);
  });

  it("returns false without an Employment", () => {
    expect(attendanceLinkShown({ kind: "no-employment" })).toBe(false);
  });

  it("returns true while the clock has not answered, as the disc keeps its place", () => {
    expect(attendanceLinkShown({ kind: "loading" })).toBe(true);
    expect(attendanceLinkShown({ kind: "unreachable" })).toBe(true);
    expect(attendanceLinkShown({ kind: "read-failed" })).toBe(true);
  });
});
