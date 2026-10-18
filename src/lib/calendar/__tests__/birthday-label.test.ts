import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import type { CalendarBirthday } from "@/lib/local-store";

import { birthdayLabel } from "../birthday-label";

const birthday = (patch: Partial<CalendarBirthday>): CalendarBirthday => ({
  userId: "petra",
  userName: "Petra Malá",
  date: "2026-10-21",
  age: 34,
  own: false,
  ...patch,
});

describe("birthdayLabel", () => {
  it("returns a colleague's birthday by first name, with the age when known", () => {
    expect(birthdayLabel(birthday({}), en)).toBe("Petra turns 34");
    expect(birthdayLabel(birthday({ age: null }), en)).toBe("Petra's birthday");
    expect(birthdayLabel(birthday({}), cs)).toBe("Petra slaví 34");
  });

  it("returns the viewer's own birthday", () => {
    expect(birthdayLabel(birthday({ own: true, age: 38 }), en)).toBe("Your birthday · 38");
    expect(birthdayLabel(birthday({ own: true, age: null }), en)).toBe("Your birthday");
  });
});
