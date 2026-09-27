import type { VacationUpdateDraft } from "@/lib/local-store";
import type { VacationDetail } from "@/lib/query/vacation-detail";

export type RequestableType = NonNullable<VacationUpdateDraft["vacationType"]>;

/** What the form fields hold: times as `HH:MM` or empty, the type null while Others has none. */
export type EditValues = {
  vacationType: RequestableType | null;
  startTime: string;
  endTime: string;
  halfDay: boolean;
  note: string;
};

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

const toMinute = (time: string | null) => (time ? time.slice(0, 5) : "");

export function editValuesOf(detail: VacationDetail): EditValues {
  return {
    vacationType: detail.vacationType === "BANK_HOLIDAY" ? null : detail.vacationType,
    startTime: toMinute(detail.startTime),
    endTime: toMinute(detail.endTime),
    halfDay: detail.halfDay,
    note: detail.note ?? "",
  };
}

export function isSingleDay(detail: Pick<VacationDetail, "rangeStart" | "rangeEnd">): boolean {
  return detail.rangeStart === detail.rangeEnd;
}

/** Dates never move here: that is a cancellation and a new request. */
export function editPatch(detail: VacationDetail, values: EditValues): VacationUpdateDraft {
  const before = editValuesOf(detail);
  const patch: VacationUpdateDraft = {};
  if (values.vacationType !== null && values.vacationType !== detail.vacationType) {
    patch.vacationType = values.vacationType;
  }
  if (values.startTime !== before.startTime || values.endTime !== before.endTime) {
    patch.startTime = values.startTime || null;
    patch.endTime = values.endTime || null;
  }
  if (isSingleDay(detail) && values.halfDay !== detail.halfDay) patch.halfDay = values.halfDay;
  const note = values.note.trim() || null;
  if (note !== detail.note) patch.note = note;
  return patch;
}

export function canSaveEdit(values: EditValues): boolean {
  if (values.vacationType === null) return false;
  if (values.vacationType === "OTHER" && values.note.trim().length === 0) return false;
  if (values.startTime && values.endTime && values.endTime <= values.startTime) return false;
  return true;
}
