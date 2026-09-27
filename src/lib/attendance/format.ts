const pad = (value: number) => String(value).padStart(2, "0");

export function formatMinutes(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  return `${Math.floor(safe / 60)}:${pad(safe % 60)}`;
}

export function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

function clockFormat(timeZone: string | null): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  try {
    return new Intl.DateTimeFormat("en-GB", timeZone ? { ...options, timeZone } : options);
  } catch {
    // An unknown zone must not blank the clock.
    return new Intl.DateTimeFormat("en-GB", options);
  }
}

/** An instant as `HH:MM` in the organization's zone, so a travelling employee sees its times. */
export function formatClockTime(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return clockFormat(timeZone).format(date);
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function weekdayIn(date: Date, locale: string, timeZone: string): string {
  try {
    return capitalised(new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(date));
  } catch {
    return capitalised(new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date));
  }
}

/**
 * An instant's weekday in the organization's zone. The auto-closed notice names days rather than
 * dates, because what it asks about is nearly always last night.
 */
export function formatWeekday(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : weekdayIn(date, locale, timeZone);
}

/** A business date's weekday, read at UTC noon so no offset moves it off its day. */
export function formatBusinessWeekday(businessDate: string, locale: string): string {
  const date = new Date(`${businessDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return businessDate;
  return weekdayIn(date, locale, "UTC");
}
