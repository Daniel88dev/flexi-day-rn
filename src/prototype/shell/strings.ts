// PROTOTYPE. Throwaway strings for the dashboard-shell prototype (issue 24). Wording is the
// web's, ported by hand; the real dictionaries land with the i18n port (issue 17).
import { useT, type Locale } from "@/prototype/i18n";

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

const en = {
  nav: {
    menu: "Menu",
    more: "More",
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
    clock: "Clock",
    newRequest: "New request",
    sections: { timeOff: "Time off", attendance: "Attendance", organization: "Organization" },
  },
  dashboard: {
    greetings: {
      night: "Good night",
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening",
    },
    greeting: (greeting: string, name: string) => `${greeting}, ${name}`,
    subtitle: "Here's who's in, who's out, and what's coming up.",
    teammates: (n: number) => `${n} ${n === 1 ? "teammate" : "teammates"}`,
    stats: {
      pendingApprovals: "Pending approvals",
      pendingApprovalsSub: "need review",
      outToday: "Out today",
      outTodaySub: "away from desk",
      comingUp: "Coming up · 14d",
      comingUpSub: "upcoming leaves",
      workingToday: "Working today",
      workingTodaySub: "at their desk",
      viewRequests: "View requests",
    },
    empty: {
      title: "No groups yet",
      body: "Create a group on the web or join one with an invite code to start tracking time off.",
      action: "Manage groups",
    },
    calendarSoon: "The month calendar lands here.",
    stub: (label: string) => `${label} lands here.`,
  },
  sync: {
    justNow: "Updated just now",
    minutesAgo: (n: number) => `Updated ${n} ${n === 1 ? "minute" : "minutes"} ago`,
    pulling: "Updating…",
    pullToRefresh: "Pull down to update",
  },
  account: {
    signedInAs: "Signed in as",
    signOut: "Sign out",
    signOutConfirm: "Sign out of this phone? The local copy of your data is deleted.",
    cancel: "Cancel",
    close: "Close",
  },
};

export type ShellDictionary = typeof en;

const cs: ShellDictionary = {
  nav: {
    menu: "Menu",
    more: "Více",
    dashboard: "Přehled",
    requests: "Žádosti",
    report: "Report",
    groups: "Skupiny",
    calendarSync: "Synchronizace kalendáře",
    myAttendance: "Moje docházka",
    teamAttendance: "Docházka týmu",
    organization: "Organizace",
    billing: "Fakturace",
    settings: "Nastavení",
    clock: "Docházka",
    newRequest: "Nová žádost",
    sections: { timeOff: "Volno", attendance: "Docházka", organization: "Organizace" },
  },
  dashboard: {
    greetings: {
      night: "Dobrou noc",
      morning: "Dobré ráno",
      afternoon: "Dobré odpoledne",
      evening: "Dobrý večer",
    },
    greeting: (greeting: string, name: string) => `${greeting}, ${name}`,
    subtitle: "Tady je, kdo je v práci, kdo je pryč a co se chystá.",
    teammates: (n: number) => `${n} ${plural(n, "kolega", "kolegové", "kolegů")}`,
    stats: {
      pendingApprovals: "Čekající schválení",
      pendingApprovalsSub: "ke kontrole",
      outToday: "Dnes mimo",
      outTodaySub: "mimo kancelář",
      comingUp: "Nadcházející · 14d",
      comingUpSub: "nadcházející volna",
      workingToday: "Dnes v práci",
      workingTodaySub: "u svého stolu",
      viewRequests: "Zobrazit žádosti",
    },
    empty: {
      title: "Zatím žádné skupiny",
      body: "Vytvořte skupinu na webu nebo se připojte pomocí zvacího kódu a začněte sledovat volno.",
      action: "Spravovat skupiny",
    },
    calendarSoon: "Tady bude měsíční kalendář.",
    stub: (label: string) => `Tady bude: ${label}.`,
  },
  sync: {
    justNow: "Aktualizováno právě teď",
    minutesAgo: (n: number) =>
      `Aktualizováno před ${n} ${plural(n, "minutou", "minutami", "minutami")}`,
    pulling: "Aktualizuji…",
    pullToRefresh: "Stáhněte dolů pro aktualizaci",
  },
  account: {
    signedInAs: "Přihlášen jako",
    signOut: "Odhlásit se",
    signOutConfirm: "Odhlásit se z tohoto telefonu? Místní kopie dat se smaže.",
    cancel: "Zrušit",
    close: "Zavřít",
  },
};

const shell: Record<Locale, ShellDictionary> = { en, cs };

export function useShellT(): ShellDictionary {
  const { locale } = useT();
  return shell[locale];
}
