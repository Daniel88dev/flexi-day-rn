/** `HH:MM` on the device's clock, in the dictionary's locale. */
export const clockTime = (locale: string, at: number) =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);

/** "17 October" on the device's calendar, in the dictionary's locale. */
export const dayAndMonth = (locale: string, iso: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(iso));
