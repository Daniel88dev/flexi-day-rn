import {
  CalendarBlankIcon,
  ChartBarIcon,
  GearIcon,
  SquaresFourIcon,
  TimerIcon,
  UsersIcon,
  type Icon,
} from "phosphor-react-native";

import type { Dictionary } from "@/i18n";
import type { ClockView } from "@/lib/attendance/clock";

export type NavLink = {
  key: string;
  label: string;
  icon: Icon;
  href: string;
  /** A route inside the tab layout, which stays registered even while the bar leaves it off. */
  tab?: true;
  /** Kept off the bar and the sheet, and still reachable by a link. */
  hidden?: boolean;
};

export type NavSectionId = "timeOff" | "attendance";

export type NavSection = { id: NavSectionId; label: string; links: NavLink[] };

export type ShellAccess = { attendanceLink: boolean };

/**
 * The web's rule for the My attendance link: attendance active, or a session still open, which a
 * lapse can strand and the clock still closes. Until the clock has answered the link stays, as the
 * disc does, so the bar does not shuffle on every launch.
 */
export function attendanceLinkShown(view: ClockView): boolean {
  if (view.kind === "no-employment") return false;
  if (view.kind !== "ready") return true;
  return view.state.active || view.state.openSession !== null;
}

/**
 * The web's sections in the same order, without the admin pages (Team attendance, Organization,
 * Billing), which the phone does not have.
 */
export function buildSections(
  t: Dictionary,
  access: ShellAccess = { attendanceLink: true }
): NavSection[] {
  return [
    {
      id: "timeOff",
      label: t.nav.sections.timeOff,
      links: [
        {
          key: "dashboard",
          label: t.nav.dashboard,
          icon: SquaresFourIcon,
          href: "/dashboard",
          tab: true,
        },
        {
          key: "requests",
          label: t.nav.requests,
          icon: CalendarBlankIcon,
          href: "/requests",
          tab: true,
        },
        { key: "report", label: t.nav.report, icon: ChartBarIcon, href: "/report" },
        { key: "groups", label: t.nav.groups, icon: UsersIcon, href: "/groups" },
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
          tab: true,
          hidden: !access.attendanceLink,
        },
      ],
    },
  ];
}

/** The links below the sections: the viewer's own settings. */
export function buildUtilityLinks(t: Dictionary): NavLink[] {
  return [{ key: "settings", label: t.nav.settings, icon: GearIcon, href: "/settings" }];
}

/**
 * Which links the tab bar carries and which stay behind More. The bar takes the first two Time
 * off links and then the first Attendance link, the same split the web's bottom bar takes; the
 * centre slot belongs to the clock and is not a link. `hiddenTabs` are the tab routes the bar
 * leaves off, which the layout still registers.
 */
export function splitForTabBar(sections: NavSection[]): {
  bar: NavLink[];
  sheet: NavSection[];
  hiddenTabs: NavLink[];
} {
  const shown = (id: NavSectionId) =>
    sections.find((section) => section.id === id)?.links.filter((link) => !link.hidden) ?? [];
  const timeOff = shown("timeOff");
  const attendance = shown("attendance");
  const bar = timeOff.slice(0, 2);
  const third = attendance[0] ?? timeOff[2];
  if (third) bar.push(third);
  const onBar = new Set(bar.map((link) => link.key));
  const sheet = sections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => !link.hidden && !onBar.has(link.key)),
    }))
    .filter((section) => section.links.length > 0);
  const hiddenTabs = sections
    .flatMap((section) => section.links)
    .filter((link) => link.tab && !onBar.has(link.key));
  return { bar, sheet, hiddenTabs };
}
