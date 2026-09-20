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
  sync: {
    syncing: "Syncing…",
    lastSynced: (age: string) => `Last synced ${age}`,
    never: "Not synced yet",
    justNow: "just now",
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    hoursAgo: (hours: number) => `${hours} h ago`,
    daysAgo: (days: number) => `${days} d ago`,
    unreachable: "Couldn't reach the server. Try again.",
  },
  auth: {
    welcome: {
      tagline: "The calm, shared calendar for team time off.",
      signIn: "Sign in",
      createOnWeb: "Create an account on the web",
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
