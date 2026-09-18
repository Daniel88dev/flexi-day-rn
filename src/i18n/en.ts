export const en = {
  nav: {
    menu: "Menu",
    more: "More",
    clock: "Clock",
    dashboard: "Dashboard",
    requests: "Requests",
    report: "Report",
    groups: "Groups",
    calendarSync: "Calendar sync",
    myAttendance: "My attendance",
    teamAttendance: "Team attendance",
    organization: "Organization",
    billing: "Billing",
    settings: "Settings",
    sections: {
      timeOff: "Time off",
      attendance: "Attendance",
      organization: "Organization",
    },
  },
  dashboard: {
    greetings: {
      night: "Good night",
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
    },
    greeting: (greeting: string, name: string) => `${greeting}, ${name}`,
    fallbackName: "there",
    subtitle: "Here's who's in, who's out, and what's coming up.",
    empty: {
      title: "Nothing to show yet",
      body: "Your time off, your team's calendar and your quotas appear here once this phone syncs with the web.",
    },
  },
  account: {
    signOut: "Sign out",
    signOutTitle: "Sign out",
    signOutBody: "Sign out of this phone? The copy of your data on it is deleted.",
    cancel: "Cancel",
  },
  common: {
    comingSoon: (screen: string) => `${screen} lands here.`,
  },
};

export type Dictionary = typeof en;
