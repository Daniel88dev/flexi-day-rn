import type { Dictionary } from "@/i18n";
import { dateOfDay, dayOfDate } from "@/lib/days";
import type { VacationDraft, WriteFailure } from "@/lib/local-store";
import type { GroupMember } from "@/lib/query";
import { runDatesLabel } from "@/lib/requests/format";
import type { RequestableType } from "@/lib/requests/form";

/** The days the backend books: this calendar year through the end of the next. */
export type BookableWindow = { min: string; max: string };

export function bookableWindow(today: Date): BookableWindow {
  const year = today.getFullYear();
  return { min: `${year}-01-01`, max: `${year + 1}-12-31` };
}

export function clampDay(day: string, { min, max }: BookableWindow): string {
  if (day < min) return min;
  if (day > max) return max;
  return day;
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayOfDate(dateOfDay(value)) === value;
}

/** `end` is the inclusive last day. */
export function openingRange(
  date: string | undefined,
  end: string | undefined,
  today: Date
): { from: string; to: string } {
  const window = bookableWindow(today);
  const from = clampDay(date && isDay(date) ? date : dayOfDate(today), window);
  if (!end || !isDay(end)) return { from, to: from };
  const to = clampDay(end, window);
  return { from, to: to < from ? from : to };
}

/**
 * What the form holds. `groupId` null means none picked yet, which the screen reads as its first
 * group; `memberId` null books for the viewer; times are `HH:MM` or empty.
 */
export type NewRequestValues = {
  groupId: string | null;
  memberId: string | null;
  autoApprove: boolean;
  vacationType: RequestableType | null;
  from: string;
  to: string;
  startTime: string;
  endTime: string;
  halfDay: boolean;
  note: string;
};

export function newRequestValues(from: string, to: string = from): NewRequestValues {
  return {
    groupId: null,
    memberId: null,
    autoApprove: true,
    vacationType: "VACATION",
    from,
    to,
    startTime: "",
    endTime: "",
    halfDay: false,
    note: "",
  };
}

export function withFrom(values: NewRequestValues, from: string): NewRequestValues {
  return { ...values, from, to: values.to < from ? from : values.to };
}

/** The backend stamps half day on every day it books, so a range never offers it. */
export function offersHalfDay(values: Pick<NewRequestValues, "from" | "to">): boolean {
  return values.from === values.to;
}

/** A Sick day picked in a group without the benefit reads as Vacation, as on the web. */
export function shownType(
  type: RequestableType | null,
  { offerSickDay }: { offerSickDay: boolean }
): RequestableType | null {
  return type === "SICK_DAY" && !offerSickDay ? "VACATION" : type;
}

/** Only what the web checks; working days, holidays, allowance and plan are the server's. */
export function canSubmit(values: NewRequestValues, offer: { offerSickDay: boolean }): boolean {
  const type = shownType(values.vacationType, offer);
  if (!values.groupId || type === null) return false;
  if (values.to < values.from) return false;
  if (type === "OTHER" && values.note.trim().length === 0) return false;
  return true;
}

export function newRequestDraft(
  values: NewRequestValues,
  { canAdmin, offerSickDay }: { canAdmin: boolean; offerSickDay: boolean }
): VacationDraft {
  const onBehalf = canAdmin && values.memberId !== null;
  return {
    groupId: values.groupId ?? "",
    ...(onBehalf ? { userId: values.memberId!, autoApprove: values.autoApprove } : {}),
    from: values.from,
    to: values.to,
    vacationType: shownType(values.vacationType, { offerSickDay }) ?? "VACATION",
    startTime: values.startTime || null,
    endTime: values.endTime || null,
    halfDay: offersHalfDay(values) && values.halfDay,
    note: values.note.trim() || null,
  };
}

/** Who an admin may book for, as the web offers them: never themselves, never a former member. */
export function bookableMembers(
  members: readonly GroupMember[],
  viewerId: string | null
): GroupMember[] {
  if (!viewerId) return [];
  return members.filter(
    (member) => member.controlledUser && member.deletedAt === null && member.userId !== viewerId
  );
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** The inline error a failed Submit shows; the form stays open with the entry as it was. */
export function submitFailureMessage(failure: WriteFailure, t: Dictionary): string {
  const labels = t.newRequest;
  if (failure.reason === "unreachable") return labels.unreachable;

  const { status, message, context } = failure;
  if (status === 409) {
    const days = stringsOf(context?.conflictingDays);
    if (days.length === 0) return message ?? labels.conflictGeneric;
    const shown = days.map((day) => runDatesLabel({ from: day, to: day }, t.requests.runDates));
    return labels.conflict(shown.join(", "));
  }
  // A lapsed plan makes a group read-only, and a member meets it first here, so the reason is
  // translated rather than left in the server's English.
  if (status === 402 && context?.reason === "READ_ONLY") return labels.readOnlyGroup;
  if (status === 402 && context?.reason === "PLAN_LIMIT") {
    return labels.memberLimitReached(typeof context.limit === "number" ? context.limit : 0);
  }
  return message ?? labels.createFailed;
}
