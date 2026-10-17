export type BirthDate = { month: number; day: number; year: number | null };

/** What `GET /api/users/me/birthday` holds for the signed-in user. */
export type MyBirthday = BirthDate & { shared: boolean };

export type BirthdayShareGroup = { groupId: string; groupName: string };

export type BirthdayOccurrence = { date: string; age: number | null };

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 29 February lands on 28 February in a year without it (D19). */
function dayIn(birthday: BirthDate, year: number): number {
  return birthday.month === 2 && birthday.day === 29 && !isLeap(year) ? 28 : birthday.day;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Each date the birthday falls on in `[from, until)`, with the age turned that day. */
export function birthdayOccurrences(
  birthday: BirthDate,
  range: { from: string; until: string }
): BirthdayOccurrence[] {
  const first = Number(range.from.slice(0, 4));
  const last = Number(range.until.slice(0, 4));
  const found: BirthdayOccurrence[] = [];
  for (let year = first; year <= last; year += 1) {
    if (birthday.year !== null && year < birthday.year) continue;
    const date = `${year}-${pad(birthday.month)}-${pad(dayIn(birthday, year))}`;
    if (date < range.from || date >= range.until) continue;
    found.push({ date, age: birthday.year === null ? null : year - birthday.year });
  }
  return found;
}

/** The age on an ISO day, or null without a year. */
export function ageOn(birthday: BirthDate, today: string): number | null {
  if (birthday.year === null) return null;
  const year = Number(today.slice(0, 4));
  const had = today.slice(5) >= `${pad(birthday.month)}-${pad(dayIn(birthday, year))}`;
  return year - birthday.year - (had ? 0 : 1);
}

/**
 * What the share switch offers (D28), as on the web. `open`: it turns on and off. `lapsed`: only
 * turning off, with the lapsed line. `notice`: no paid or lapsed group, the notice replaces it.
 */
export type ShareSwitchState = "open" | "lapsed" | "notice";

export function shareSwitchState(input: {
  canShare: boolean;
  storedShared: boolean;
  shareGroups: readonly BirthdayShareGroup[];
}): ShareSwitchState {
  if (input.canShare) return "open";
  if (input.storedShared || input.shareGroups.length > 0) return "lapsed";
  return "notice";
}

export type AudienceRow =
  | { who: "you" | "teamFeeds" | "providers"; date: boolean; age: boolean }
  | { who: "groups"; names: string[]; date: boolean; age: boolean };

/** Who sees the date and who the age: team feeds never carry the age, providers nothing. */
export function audience({
  birthday,
  shareGroups,
}: {
  birthday: MyBirthday | null;
  shareGroups: readonly BirthdayShareGroup[];
}): AudienceRow[] {
  const hasYear = birthday?.year != null;
  const shown = birthday !== null && birthday.shared && shareGroups.length > 0;
  return [
    { who: "you", date: birthday !== null, age: hasYear },
    {
      who: "groups",
      names: shareGroups.map((group) => group.groupName),
      date: shown,
      age: shown && hasYear,
    },
    { who: "teamFeeds", date: shown, age: false },
    { who: "providers", date: false, age: false },
  ];
}

/** The edit sheet's state: the wheel always holds a year, the switch says whether it is saved. */
export type BirthdayDraft = {
  date: { month: number; day: number; year: number };
  withYear: boolean;
};

/** A leap year, so the wheel can stop on 29 February. */
const WHEEL_YEAR = 2000;

export function draftOf(birthday: MyBirthday | null): BirthdayDraft {
  if (!birthday) return { date: { month: 1, day: 1, year: WHEEL_YEAR }, withYear: false };
  return {
    date: { month: birthday.month, day: birthday.day, year: birthday.year ?? WHEEL_YEAR },
    withYear: birthday.year !== null,
  };
}

export function savedBirthday(draft: BirthdayDraft, shared: boolean): MyBirthday {
  const { month, day, year } = draft.date;
  return { month, day, year: draft.withYear ? year : null, shared };
}
