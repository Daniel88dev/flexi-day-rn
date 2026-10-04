import { getCalendars, getLocales } from "expo-localization";

import { cs } from "./cs";
import { en, type Dictionary } from "./en";

export type Locale = "en" | "cs";

export const dictionaries: Record<Locale, Dictionary> = { en, cs };

export type { Dictionary };

/** The device language, falling back to English for anything the app has no dictionary for. */
export function deviceLocale(): Locale {
  return getLocales()[0]?.languageCode === "cs" ? "cs" : "en";
}

/** The device's own clock setting; iOS reports null only when it cannot tell, and the app is 24-hour. */
export function deviceUses24HourClock(): boolean {
  return getCalendars()[0]?.uses24hourClock !== false;
}
