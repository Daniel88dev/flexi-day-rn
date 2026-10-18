// The web's `lib/group-events/draft.ts` carries the same rules; change them together.
import type { CalendarGroupEvent } from "@/lib/local-store";

import {
  daysBetween,
  monthPosition,
  occurrences,
  plusDays,
  weekdayOf,
  type IsoDate,
  type RepeatRule,
} from "./occurrences";

export type GroupEventScope = "this" | "following" | "all";

/** The fields a group event is made of, as `POST` takes them and `PATCH` changes them. */
type GroupEventShape = {
  title: string;
  note: string | null;
  startDate: IsoDate;
  endDate: IsoDate;
  startTime: string | null;
  endTime: string | null;
  repeat: RepeatRule | null;
};

export type CreateGroupEventInput = GroupEventShape & { groupId: string };

/** A missing field keeps its value; `null` clears it, `repeat: null` turns repeat off. */
export type GroupEventChanges = Partial<GroupEventShape>;

export type GroupEventEditRequest = {
  scope?: GroupEventScope;
  occurrenceDate?: IsoDate;
  changes: GroupEventChanges;
};

/** The group event as stored, at the start its rule is read off, and the occurrence picked. */
export interface GroupEventTarget {
  event: GroupEventShape & { id: string; groupId: string };
  /** The occurrence's first day; for a one-off, its start date. */
  occurrenceDate: IsoDate;
}

/** The editor's form. Times stay filled while all-day is on, so switching back keeps them. */
export interface GroupEventDraft {
  groupId: string | null;
  title: string;
  note: string;
  startDate: IsoDate;
  endDate: IsoDate;
  allDay: boolean;
  startTime: string;
  endTime: string;
  /** As the user set it; `fitRule` adapts it to the start before it is shown or sent. */
  repeat: RepeatRule | null;
}

export type DraftProblem = "title" | "group" | "endsBeforeStart" | "untilBeforeStart";

const PREVIEW_COUNT = 6;
const DEFAULT_START = "09:00";
const DEFAULT_END = "10:00";

export function targetOf(occurrence: CalendarGroupEvent): GroupEventTarget {
  const { id, groupId, title, note, startTime, endTime, repeat, ruleStartDate } = occurrence;
  return {
    event: {
      id,
      groupId,
      title,
      note,
      startDate: ruleStartDate,
      endDate: repeat ? ruleStartDate : occurrence.endDate,
      startTime,
      endTime,
      repeat,
    },
    occurrenceDate: occurrence.startDate,
  };
}

export function blankDraft(date: IsoDate, groupId: string | null): GroupEventDraft {
  return {
    groupId,
    title: "",
    note: "",
    startDate: date,
    endDate: date,
    allDay: true,
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
    repeat: null,
  };
}

export function defaultRule(freq: RepeatRule["freq"], start: IsoDate): RepeatRule {
  return {
    freq,
    interval: 1,
    weekdays: freq === "weekly" ? [weekdayOf(start)] : [],
    monthlyMode: freq === "monthly" ? "day" : null,
    until: null,
  };
}

/** The rule as the start allows it: the start's weekday always repeats, monthly modes it can't take switch. */
export function fitRule(rule: RepeatRule, start: IsoDate): RepeatRule {
  const { nth, isLast } = monthPosition(start);
  let monthlyMode = rule.freq === "monthly" ? (rule.monthlyMode ?? "day") : null;
  if (monthlyMode === "weekday" && nth > 4) monthlyMode = "lastWeekday";
  if (monthlyMode === "lastWeekday" && !isLast) monthlyMode = "weekday";
  return {
    freq: rule.freq,
    interval: rule.interval,
    weekdays:
      rule.freq === "weekly"
        ? [...new Set([...rule.weekdays, weekdayOf(start)])].sort((a, b) => a - b)
        : [],
    monthlyMode,
    until: rule.until,
  };
}

const sortedDays = (days: readonly number[]) => [...days].sort((a, b) => a - b).join();

function sameRule(a: RepeatRule | null, b: RepeatRule | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.freq === b.freq &&
    a.interval === b.interval &&
    (a.monthlyMode ?? null) === (b.monthlyMode ?? null) &&
    a.until === b.until &&
    sortedDays(a.weekdays) === sortedDays(b.weekdays)
  );
}

/** The next six dates the rule produces from the start, fewer when it ends sooner. */
export function nextDates(start: IsoDate, rule: RepeatRule): IsoDate[] {
  const fitted = fitRule(rule, start);
  const reach = plusDays(start, PREVIEW_COUNT * fitted.interval * 366);
  return occurrences(
    { startDate: start, endDate: start, repeat: fitted, skippedDates: [] },
    start,
    reach
  )
    .slice(0, PREVIEW_COUNT)
    .map((o) => o.startDate);
}

/**
 * Applies a date change: a moved start keeps the event's length, the end never falls before the
 * start, and a run of days cannot repeat.
 */
export function withDates(
  draft: GroupEventDraft,
  dates: { startDate?: IsoDate; endDate?: IsoDate }
): GroupEventDraft {
  const startDate = dates.startDate ?? draft.startDate;
  let endDate = dates.endDate ?? plusDays(draft.endDate, daysBetween(draft.startDate, startDate));
  if (endDate < startDate) endDate = startDate;
  return {
    ...draft,
    startDate,
    endDate,
    repeat: endDate === startDate ? draft.repeat : null,
  };
}

export function draftProblem(draft: GroupEventDraft): DraftProblem | null {
  if (!draft.title.trim()) return "title";
  if (!draft.groupId) return "group";
  if (!draft.allDay && draft.startDate === draft.endDate && draft.endTime <= draft.startTime) {
    return "endsBeforeStart";
  }
  if (draft.repeat?.until && draft.repeat.until < draft.startDate) return "untilBeforeStart";
  return null;
}

function content(draft: GroupEventDraft) {
  return {
    title: draft.title.trim(),
    note: draft.note.trim() || null,
    startTime: draft.allDay ? null : draft.startTime,
    endTime: draft.allDay ? null : draft.endTime,
  };
}

export function createInput(draft: GroupEventDraft): CreateGroupEventInput {
  return {
    groupId: draft.groupId ?? "",
    ...content(draft),
    startDate: draft.startDate,
    endDate: draft.endDate,
    repeat: draft.repeat ? fitRule(draft.repeat, draft.startDate) : null,
  };
}

/** A recurring group event opens on the occurrence picked; a one-off on its own dates. */
export function draftFromTarget({ event, occurrenceDate }: GroupEventTarget): GroupEventDraft {
  return {
    groupId: event.groupId,
    title: event.title,
    note: event.note ?? "",
    startDate: event.repeat ? occurrenceDate : event.startDate,
    endDate: event.repeat ? occurrenceDate : event.endDate,
    allDay: event.startTime === null,
    startTime: event.startTime?.slice(0, 5) ?? DEFAULT_START,
    endTime: event.endTime?.slice(0, 5) ?? DEFAULT_END,
    repeat: event.repeat,
  };
}

/** Whether the user changed the rule itself; moving the date alone does not count. */
export function ruleChanged(event: GroupEventTarget["event"], draft: GroupEventDraft): boolean {
  return !sameRule(event.repeat, draft.repeat);
}

/** Every weekday moved by the same number of days the dates moved. */
function shiftRule(rule: RepeatRule, days: number): RepeatRule {
  if (rule.freq !== "weekly" || days % 7 === 0) return rule;
  return { ...rule, weekdays: rule.weekdays.map((d) => (((d + days) % 7) + 7) % 7) };
}

/**
 * The `PATCH` for a draft. "This event" never sends the rule. "This and following" starts the new
 * rule on the draft's date. "All events" moves the first date, and with it every date, by as many
 * days as the occurrence moved.
 */
export function editRequest(
  target: GroupEventTarget,
  draft: GroupEventDraft,
  scope: GroupEventScope | undefined
): GroupEventEditRequest {
  const { event, occurrenceDate } = target;
  const base = content(draft);
  const rule = (start: IsoDate, r: RepeatRule | null) => (r ? fitRule(r, start) : null);

  if (!event.repeat || !scope) {
    return {
      changes: {
        ...base,
        startDate: draft.startDate,
        endDate: draft.endDate,
        repeat: rule(draft.startDate, draft.repeat),
      },
    };
  }

  let changes: GroupEventChanges;
  if (scope === "this") {
    changes = { ...base, startDate: draft.startDate, endDate: draft.startDate };
  } else if (scope === "following") {
    changes = {
      ...base,
      startDate: draft.startDate,
      endDate: draft.endDate,
      repeat: rule(draft.startDate, draft.repeat),
    };
  } else {
    const shift = daysBetween(occurrenceDate, draft.startDate);
    const startDate = plusDays(event.startDate, shift);
    changes = {
      ...base,
      startDate,
      endDate: plusDays(startDate, daysBetween(draft.startDate, draft.endDate)),
      repeat: rule(startDate, draft.repeat && shiftRule(draft.repeat, shift)),
    };
  }
  return { scope, occurrenceDate, changes };
}
