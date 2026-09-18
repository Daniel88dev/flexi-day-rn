// PROTOTYPE. The web's navigation tree (lib/navigation/shell-links.ts) as the phone would see
// it: the same destinations, the same section order, the same admin gating.
import {
  ArrowsClockwiseIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  CreditCardIcon,
  GearIcon,
  SquaresFourIcon,
  TimerIcon,
  UsersIcon,
  UsersThreeIcon,
  type Icon,
} from "phosphor-react-native";

import type { ShellDictionary } from "@/prototype/shell/strings";

export type Role = "member" | "admin";

export type NavLink = { key: string; label: string; icon: Icon };
export type NavSection = {
  id: "timeOff" | "attendance" | "organization";
  label: string;
  links: NavLink[];
};

export function buildSections(t: ShellDictionary, role: Role): NavSection[] {
  const admin = role === "admin";
  const sections: NavSection[] = [
    {
      id: "timeOff",
      label: t.nav.sections.timeOff,
      links: [
        { key: "dashboard", label: t.nav.dashboard, icon: SquaresFourIcon },
        { key: "requests", label: t.nav.requests, icon: CalendarBlankIcon },
        { key: "report", label: t.nav.report, icon: ChartBarIcon },
        { key: "groups", label: t.nav.groups, icon: UsersIcon },
        { key: "calendarSync", label: t.nav.calendarSync, icon: ArrowsClockwiseIcon },
      ],
    },
    {
      id: "attendance",
      label: t.nav.sections.attendance,
      links: [
        { key: "myAttendance", label: t.nav.myAttendance, icon: TimerIcon },
        ...(admin
          ? [{ key: "teamAttendance", label: t.nav.teamAttendance, icon: UsersThreeIcon }]
          : []),
      ],
    },
    {
      id: "organization",
      label: t.nav.sections.organization,
      links: admin
        ? [
            { key: "organization", label: t.nav.organization, icon: BuildingsIcon },
            { key: "billing", label: t.nav.billing, icon: CreditCardIcon },
          ]
        : [],
    },
  ];
  return sections.filter((section) => section.links.length > 0);
}

export function buildUtility(t: ShellDictionary): NavLink[] {
  return [{ key: "settings", label: t.nav.settings, icon: GearIcon }];
}

/** The web's split: first two Time off links, the clock in the middle, then the first Attendance link. */
export function splitForBottomBar(sections: NavSection[]): { bar: NavLink[]; sheet: NavSection[] } {
  const timeOff = sections.find((s) => s.id === "timeOff")?.links ?? [];
  const attendance = sections.find((s) => s.id === "attendance")?.links ?? [];
  const bar = timeOff.slice(0, 2);
  const third = attendance[0] ?? timeOff[2];
  if (third) bar.push(third);
  const onBar = new Set(bar.map((link) => link.key));
  const sheet = sections
    .map((section) => ({ ...section, links: section.links.filter((l) => !onBar.has(l.key)) }))
    .filter((section) => section.links.length > 0);
  return { bar, sheet };
}

export function findLink(sections: NavSection[], utility: NavLink[], key: string): NavLink | null {
  for (const section of sections) {
    const link = section.links.find((candidate) => candidate.key === key);
    if (link) return link;
  }
  return utility.find((candidate) => candidate.key === key) ?? null;
}
