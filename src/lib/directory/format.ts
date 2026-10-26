/** "30 Jun 2026" on the device's calendar, in the dictionary's locale. */
export const directoryDate = (locale: string, iso: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso)
  );
