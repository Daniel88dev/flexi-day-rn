import type { Dictionary } from "./en";

export const cs: Dictionary = {
  nav: {
    menu: "Menu",
    more: "Více",
    clock: "Docházka",
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
    sections: {
      timeOff: "Volno",
      attendance: "Docházka",
      organization: "Organizace",
    },
  },
  dashboard: {
    greetings: {
      night: "Dobrou noc",
      morning: "Dobré ráno",
      afternoon: "Dobré odpoledne",
      evening: "Dobrý večer",
    },
    greeting: (greeting: string, name: string) => `${greeting}, ${name}`,
    fallbackName: "vítejte",
    subtitle: "Tady je, kdo je v práci, kdo je pryč a co se chystá.",
    empty: {
      title: "Zatím není co zobrazit",
      body: "Vaše volno, kalendář týmu a vaše limity se tu objeví, jakmile se telefon sesynchronizuje s webem.",
    },
  },
  account: {
    signOut: "Odhlásit se",
    signOutTitle: "Odhlásit se",
    signOutBody: "Odhlásit se z tohoto telefonu? Kopie vašich dat na něm se smaže.",
    cancel: "Zrušit",
  },
  common: {
    comingSoon: (screen: string) => `Tady bude: ${screen}.`,
  },
};
