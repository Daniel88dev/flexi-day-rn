/** `HH:MM` on the device's clock, in the dictionary's locale. */
export const clockTime = (locale: string, at: number) =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);
