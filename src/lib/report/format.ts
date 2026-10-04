/** Whole days bare, anything else to one decimal, with the dictionary's decimal separator. */
export function formatDays(value: number, decimalSeparator: string): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return text.replace(".", decimalSeparator);
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatKeptAt(
  at: Date,
  today: Date,
  locale: string,
  uses24HourClock: boolean
): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: uses24HourClock ? "2-digit" : "numeric",
    minute: "2-digit",
    hourCycle: uses24HourClock ? "h23" : "h12",
  };
  if (!sameDay(at, today)) Object.assign(options, { day: "numeric", month: "short" });
  return new Intl.DateTimeFormat(locale, options).format(at);
}
