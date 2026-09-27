import type { VacationDraft } from "@/lib/local-store";

/** What either form offers as a type: anything but a bank holiday, which is the admin's to grant. */
export type RequestableType = NonNullable<VacationDraft["vacationType"]>;

const PRIMARY: readonly RequestableType[] = ["VACATION", "HOME_OFFICE", "SICK"];
const OTHERS: readonly RequestableType[] = [
  "PAID_TIME_OFF",
  "NON_PAID_LEAVE",
  "STUDY_LEAVE",
  "OTHER",
];

export function requestableTypes({
  offerSickDay,
  current,
}: {
  offerSickDay: boolean;
  current?: RequestableType;
}): { primary: RequestableType[]; others: RequestableType[] } {
  const others: RequestableType[] = offerSickDay ? ["SICK_DAY", ...OTHERS] : [...OTHERS];
  // An edit must never quietly retype a request to something the list no longer offers.
  if (current && !PRIMARY.includes(current) && !others.includes(current)) others.push(current);
  return { primary: [...PRIMARY], others };
}
