import type { Dictionary } from "@/i18n/en";
import type { CalendarBirthday } from "@/lib/local-store";
import { firstName } from "@/lib/viewer/viewer";

/** "Your birthday · 38", "Petra turns 34", "Tomáš's birthday". */
export function birthdayLabel(birthday: CalendarBirthday, t: Dictionary): string {
  const labels = t.dashboard.calendar;
  const name = firstName(birthday.userName ?? undefined, "?");
  if (birthday.own) {
    return birthday.age === null ? labels.yourBirthday : labels.yourBirthdayAge(birthday.age);
  }
  return birthday.age === null ? labels.namesBirthday(name) : labels.nameTurns(name, birthday.age);
}
