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

import type { Dictionary } from "@/i18n";

export type NavLink = { key: string; label: string; icon: Icon; href: string };

export type NavSectionId = "timeOff" | "attendance" | "organization";

export type NavSection = { id: NavSectionId; label: string; links: NavLink[] };

export type ShellAccess = {
  /** Org admin (owner or delegate) or group admin. */
  administersSomething: boolean;
};

/**
 * The web's sections in the same order, gated the same way: a section with no link the viewer
 * may reach is left out rather than rendered empty.
 */
export function buildSections(t: Dictionary, access: ShellAccess): NavSection[] {
  const sections: NavSection[] = [
    {
      id: "timeOff",
      label: t.nav.sections.timeOff,
      links: [
        { key: "dashboard", label: t.nav.dashboard, icon: SquaresFourIcon, href: "/dashboard" },
        { key: "requests", label: t.nav.requests, icon: CalendarBlankIcon, href: "/requests" },
        { key: "report", label: t.nav.report, icon: ChartBarIcon, href: "/report" },
        { key: "groups", label: t.nav.groups, icon: UsersIcon, href: "/groups" },
        {
          key: "calendarSync",
          label: t.nav.calendarSync,
          icon: ArrowsClockwiseIcon,
          href: "/calendar-sync",
        },
      ],
    },
    {
      id: "attendance",
      label: t.nav.sections.attendance,
      links: [
        {
          key: "myAttendance",
          label: t.nav.myAttendance,
          icon: TimerIcon,
          href: "/my-attendance",
        },
        ...(access.administersSomething
          ? [
              {
                key: "teamAttendance",
                label: t.nav.teamAttendance,
                icon: UsersThreeIcon,
                href: "/team-attendance",
              },
            ]
          : []),
      ],
    },
    {
      id: "organization",
      label: t.nav.sections.organization,
      links: access.administersSomething
        ? [
            {
              key: "organization",
              label: t.nav.organization,
              icon: BuildingsIcon,
              href: "/organization",
            },
            { key: "billing", label: t.nav.billing, icon: CreditCardIcon, href: "/billing" },
          ]
        : [],
    },
  ];
  return sections.filter((section) => section.links.length > 0);
}

/** The links below the sections: the viewer's own settings. */
export function buildUtilityLinks(t: Dictionary): NavLink[] {
  return [{ key: "settings", label: t.nav.settings, icon: GearIcon, href: "/settings" }];
}

/**
 * Which links the tab bar carries and which stay behind More. The bar takes the first two Time
 * off links and then the first Attendance link, the same split the web's bottom bar takes; the
 * centre slot belongs to the clock and is not a link.
 */
export function splitForTabBar(sections: NavSection[]): { bar: NavLink[]; sheet: NavSection[] } {
  const timeOff = sections.find((section) => section.id === "timeOff")?.links ?? [];
  const attendance = sections.find((section) => section.id === "attendance")?.links ?? [];
  const bar = timeOff.slice(0, 2);
  const third = attendance[0] ?? timeOff[2];
  if (third) bar.push(third);
  const onBar = new Set(bar.map((link) => link.key));
  const sheet = sections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => !onBar.has(link.key)),
    }))
    .filter((section) => section.links.length > 0);
  return { bar, sheet };
}
