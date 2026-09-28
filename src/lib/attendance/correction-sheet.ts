import { addDays } from "@/lib/days";

import {
  breakErrors,
  correctionErrors,
  draftEdited,
  instantAt,
  resolveBreaks,
  sessionDraft,
  timeFieldOf,
  toBreakPatch,
  toNewBreaks,
  toPatch,
  type BreakDraft,
  type CorrectionErrors,
  type CorrectionPatch,
  type SessionDraft,
} from "./correction";
import type { ClosedReason } from "./entry-form";
import type { EntryFailure } from "./refusals";
import { selfServiceVerdict } from "./self-service";
import type {
  AttendanceBreak,
  AttendanceBreakSpan,
  AttendanceSession,
  AttendanceState,
} from "./types";

/**
 * One break as the correction sheet holds it. A saved break the reader removed stays in the list,
 * struck through, until Save deletes it; `running` is a break still open, whose end is the clock's.
 */
export type HeldBreak = BreakDraft & { removed?: boolean; running?: boolean };

export type HeldDraft = { startedAt: string; endedAt: string; breaks: HeldBreak[] };

export function heldDraft(session: AttendanceSession, timezone: string | null): HeldDraft {
  const draft = sessionDraft(session, timezone);
  return {
    ...draft,
    breaks: draft.breaks.map((entry) => ({
      ...entry,
      running: session.breaks.find((saved) => saved.id === entry.id)?.endedAt === null,
    })),
  };
}

/** The draft as it would stand once saved: removed breaks gone, the sheet's own marks dropped. */
export function liveDraft(draft: HeldDraft): SessionDraft {
  return {
    startedAt: draft.startedAt,
    endedAt: draft.endedAt,
    breaks: draft.breaks
      .filter((entry) => !entry.removed)
      .map(({ id, startedAt, endedAt, isNew }) => ({
        id,
        startedAt,
        endedAt,
        ...(isNew ? { isNew } : {}),
      })),
  };
}

export function heldEdited(
  session: AttendanceSession,
  draft: HeldDraft,
  timezone: string | null
): boolean {
  return draftEdited(session, liveDraft(draft), timezone);
}

const mapBreaks = (draft: HeldDraft, map: (entry: HeldBreak) => HeldBreak[]): HeldDraft => ({
  ...draft,
  breaks: draft.breaks.flatMap(map),
});

const NEW_ID = /^new-(\d+)$/;

/** A new empty break, numbered after the new ones the draft holds so no two share an id. */
export function withBreakAdded(draft: HeldDraft): HeldDraft {
  const last = Math.max(0, ...draft.breaks.map((entry) => Number(NEW_ID.exec(entry.id)?.[1] ?? 0)));
  const id = `new-${last + 1}`;
  return { ...draft, breaks: [...draft.breaks, { id, startedAt: "", endedAt: "", isNew: true }] };
}

export function withBreakChanged(
  draft: HeldDraft,
  id: string,
  patch: Partial<Pick<BreakDraft, "startedAt" | "endedAt">>
): HeldDraft {
  return mapBreaks(draft, (entry) => [entry.id === id ? { ...entry, ...patch } : entry]);
}

/** A break only the sheet knows goes at once; a saved one waits, struck through, for Save. */
export function withBreakRemoved(draft: HeldDraft, id: string): HeldDraft {
  return mapBreaks(draft, (entry) => {
    if (entry.id !== id) return [entry];
    return entry.isNew ? [] : [{ ...entry, removed: true }];
  });
}

export function withBreakRestored(draft: HeldDraft, id: string): HeldDraft {
  return mapBreaks(draft, (entry) => {
    if (entry.id !== id) return [entry];
    const { removed: _removed, ...restored } = entry;
    return [restored];
  });
}

/** One request of a Save, in the order it has to go. */
export type CorrectionStep =
  | { kind: "delete-break"; breakId: string }
  | { kind: "patch-session"; sessionId: string; patch: CorrectionPatch }
  | { kind: "patch-break"; breakId: string; patch: CorrectionPatch }
  | { kind: "add-break"; sessionId: string; draftId: string; span: AttendanceBreakSpan };

const sameSpan = (entry: AttendanceBreak, span: AttendanceBreakSpan) =>
  entry.endedAt !== null &&
  Date.parse(entry.startedAt) === Date.parse(span.startedAt) &&
  Date.parse(entry.endedAt) === Date.parse(span.endedAt);

/**
 * The held draft over the session as the server now answers. An end the clock or the sweep set
 * while the sheet was open fills the empty one, so nothing reads as a reopen; a new break the
 * server already holds, added by a Save whose answer was lost, takes the server's id.
 */
export function rebaseDraft(
  draft: HeldDraft,
  session: AttendanceSession,
  timezone: string | null
): HeldDraft {
  const tracked = new Set(draft.breaks.map((entry) => entry.id));
  const untracked = session.breaks.filter((entry) => !tracked.has(entry.id));
  const spans = new Map(
    toNewBreaks(liveDraft(draft), session.businessDate, timezone).map(({ id, span }) => [id, span])
  );
  const adopted = new Set<string>();

  return {
    ...draft,
    endedAt:
      draft.endedAt === "" && session.endedAt !== null
        ? timeFieldOf(session.endedAt, timezone)
        : draft.endedAt,
    breaks: draft.breaks.map((entry) => {
      if (entry.isNew) {
        const span = spans.get(entry.id);
        const match = span
          ? untracked.find((saved) => !adopted.has(saved.id) && sameSpan(saved, span))
          : undefined;
        if (!match) return entry;
        adopted.add(match.id);
        return { id: match.id, startedAt: entry.startedAt, endedAt: entry.endedAt, running: false };
      }
      const saved = session.breaks.find((candidate) => candidate.id === entry.id);
      if (entry.endedAt !== "" || !saved?.endedAt) return entry;
      return { ...entry, endedAt: timeFieldOf(saved.endedAt, timezone), running: false };
    }),
  };
}

const later = (next: string, current: string) => Date.parse(next) > Date.parse(current);

// This sheet never reopens anything: an end is only ever moved, never cleared.
const withoutReopen = (patch: CorrectionPatch | null): CorrectionPatch | null => {
  if (!patch) return null;
  const { endedAt, ...rest } = patch;
  const kept = endedAt === null || endedAt === undefined ? rest : { ...rest, endedAt };
  return Object.keys(kept).length === 0 ? null : kept;
};

/** The session's patch split into what widens it, sent before the breaks, and what narrows it. */
function splitSessionPatch(
  patch: CorrectionPatch | null,
  session: AttendanceSession
): { widen: CorrectionPatch | null; narrow: CorrectionPatch | null } {
  const widen: CorrectionPatch = {};
  const narrow: CorrectionPatch = {};
  if (patch?.startedAt !== undefined) {
    (later(patch.startedAt, session.startedAt) ? narrow : widen).startedAt = patch.startedAt;
  }
  if (typeof patch?.endedAt === "string") {
    const narrows = session.endedAt !== null && later(session.endedAt, patch.endedAt);
    (narrows ? narrow : widen).endedAt = patch.endedAt;
  }
  const orNull = (part: CorrectionPatch) => (Object.keys(part).length === 0 ? null : part);
  return { widen: orNull(widen), narrow: orNull(narrow) };
}

type Span = { start: number; end: number };
type BreakMove = { step: CorrectionStep; from: Span; to: Span };

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/**
 * Break patches in an order the backend takes one at a time: a break moving into another's slot
 * goes after that one has moved out. Two breaks trading places cannot be ordered, and keep theirs.
 */
function orderBreakMoves(moves: BreakMove[]): CorrectionStep[] {
  const ordered: CorrectionStep[] = [];
  const left = [...moves];
  while (left.length > 0) {
    const free = left.findIndex((move) =>
      left.every((other) => other === move || !overlaps(move.to, other.from))
    );
    const [next] = left.splice(free === -1 ? 0 : free, 1);
    if (next) ordered.push(next.step);
  }
  return ordered;
}

/**
 * What one Save sends, measured against the session as the server last answered, so a retry after
 * a Save that landed in part sends only what is still missing. Removed breaks go first. Whatever
 * widens the session goes before the breaks move and whatever narrows it after, or the rule that
 * keeps a break inside its session refuses one of them. New breaks go last, checked against the
 * session and breaks as corrected.
 */
export function correctionSteps(
  session: AttendanceSession,
  held: HeldDraft,
  timezone: string | null
): CorrectionStep[] {
  const draft = rebaseDraft(held, session, timezone);
  const onServer = new Set(session.breaks.map((entry) => entry.id));
  const deletes: CorrectionStep[] = draft.breaks
    .filter((entry) => entry.removed && onServer.has(entry.id))
    .map((entry) => ({ kind: "delete-break", breakId: entry.id }));

  const live = liveDraft(draft);
  const { widen, narrow } = splitSessionPatch(
    withoutReopen(toPatch(session, live, timezone)),
    session
  );
  const patchSession = (patch: CorrectionPatch | null): CorrectionStep[] =>
    patch ? [{ kind: "patch-session", sessionId: session.id, patch }] : [];

  const sessionEnd = session.endedAt === null ? Infinity : Date.parse(session.endedAt);
  const moves: BreakMove[] = session.breaks.flatMap((entry) => {
    const patch = withoutReopen(toBreakPatch(entry, live, session.businessDate, timezone));
    if (!patch) return [];
    const from = {
      start: Date.parse(entry.startedAt),
      end: entry.endedAt === null ? sessionEnd : Date.parse(entry.endedAt),
    };
    const to = {
      start: patch.startedAt ? Date.parse(patch.startedAt) : from.start,
      end: patch.endedAt ? Date.parse(patch.endedAt) : from.end,
    };
    return [{ step: { kind: "patch-break" as const, breakId: entry.id, patch }, from, to }];
  });

  const adds: CorrectionStep[] = toNewBreaks(live, session.businessDate, timezone).map(
    ({ id, span }) => ({ kind: "add-break", sessionId: session.id, draftId: id, span })
  );

  return [
    ...deletes,
    ...patchSession(widen),
    ...orderBreakMoves(moves),
    ...patchSession(narrow),
    ...adds,
  ];
}

export type LandedStep = { step: CorrectionStep; answer: AttendanceSession };

/** Sends the steps one at a time and stops at the first that fails; what landed stays landed. */
export async function runCorrection(
  steps: CorrectionStep[],
  send: (step: CorrectionStep) => Promise<AttendanceSession>
): Promise<{ landed: LandedStep[]; failure: unknown }> {
  const landed: LandedStep[] = [];
  for (const step of steps) {
    try {
      landed.push({ step, answer: await send(step) });
    } catch (failure) {
      return { landed, failure };
    }
  }
  return { landed, failure: null };
}

/** The id the server gave a break it just added, found by its times in the session it answered. */
const savedBreakId = (answer: AttendanceSession, span: AttendanceBreakSpan): string | undefined =>
  answer.breaks.find((entry) => sameSpan(entry, span))?.id;

/**
 * The draft after a Save that landed in part: a deleted break is gone, an added one is saved under
 * the server's id, so the retry neither deletes nor adds it again.
 */
export function settleDraft(draft: HeldDraft, landed: LandedStep[]): HeldDraft {
  return landed.reduce<HeldDraft>((current, { step, answer }) => {
    if (step.kind === "delete-break") {
      return mapBreaks(current, (entry) => (entry.id === step.breakId ? [] : [entry]));
    }
    if (step.kind !== "add-break") return current;
    const id = savedBreakId(answer, step.span) ?? step.draftId;
    return mapBreaks(current, (entry) =>
      entry.id === step.draftId
        ? [{ id, startedAt: entry.startedAt, endedAt: entry.endedAt, running: false }]
        : [entry]
    );
  }, draft);
}

/**
 * Why the reader may not correct this session, as the backend would refuse it, or null when they
 * may. Decided per session, as the API does: a session still open is inside the window whatever
 * its date.
 */
export function correctionClosed({
  state,
  session,
  today,
}: {
  state: AttendanceState;
  session: AttendanceSession;
  today: string;
}): Exclude<ClosedReason, "OUTSIDE_EMPLOYMENT"> | null {
  if (!state.active) return "PLAN_LIMIT";
  if (state.employmentEnded) return "EMPLOYMENT_ENDED";
  if (!state.selfService?.enabled) return "SELF_SERVICE_OFF";
  const verdict = selfServiceVerdict({
    window: state.selfService,
    businessDate: session.businessDate,
    today,
    open: session.open,
    employmentEnded: false,
  });
  return verdict === "OPEN" ? null : "SELF_SERVICE_WINDOW";
}

export type Deletability =
  | { deletable: true; entered: boolean }
  | { deletable: false; hint: "CLOCKED_EARLIER" | "ENTERED_BY_ADMIN" };

/**
 * The API's rule: an entered session only by whoever entered it, whatever its date; a clocked one
 * only on its own day.
 */
export function sessionDeletable({
  session,
  today,
  viewerId,
}: {
  session: AttendanceSession;
  today: string;
  viewerId: string | null;
}): Deletability {
  if (session.origin === "ENTERED") {
    return viewerId !== null && session.enteredByUserId === viewerId
      ? { deletable: true, entered: true }
      : { deletable: false, hint: "ENTERED_BY_ADMIN" };
  }
  return session.businessDate === today
    ? { deletable: true, entered: false }
    : { deletable: false, hint: "CLOCKED_EARLIER" };
}

/** Whether saving marks the session Changed after the day. An admin's own write clears it instead. */
export function flagsOnSave({
  session,
  today,
  administersOwn,
}: {
  session: AttendanceSession;
  today: string;
  administersOwn: boolean;
}): boolean {
  return !administersOwn && session.businessDate < today;
}

/** The session's ends as instants; a session still running counts to `now`. */
function sessionSpan(
  draft: SessionDraft,
  businessDate: string,
  timezone: string | null,
  now: Date
): { startedAt: string | null; endedAt: string | null } {
  const startedAt = instantAt(businessDate, draft.startedAt, timezone);
  if (draft.endedAt === "") return { startedAt, endedAt: now.toISOString() };
  const sameDay = instantAt(businessDate, draft.endedAt, timezone);
  const overnight = sameDay !== null && startedAt !== null && sameDay < startedAt;
  return {
    startedAt,
    endedAt: overnight ? instantAt(addDays(businessDate, 1), draft.endedAt, timezone) : sameDay,
  };
}

/**
 * The draft's errors. A break the clock is still running counts to the session's end, or to now
 * while the session runs too, as the backend counts it: it still has to sit inside the session
 * and clear of the other breaks, only its end is not asked for.
 */
export function correctionSheetErrors(
  draft: HeldDraft,
  businessDate: string,
  timezone: string | null,
  now: Date = new Date()
): CorrectionErrors {
  const live = liveDraft(draft);
  const {
    breaks: _breaks,
    overlaps: _overlaps,
    ...fields
  } = correctionErrors(live, businessDate, timezone);
  const span = sessionSpan(live, businessDate, timezone, now);
  const running = new Set(
    draft.breaks
      .filter((entry) => entry.running && entry.endedAt === "" && !entry.removed)
      .map((entry) => entry.id)
  );
  const resolved = resolveBreaks(live.breaks, businessDate, span, timezone).map((entry) =>
    running.has(entry.id) ? { ...entry, endedAt: span.endedAt } : entry
  );
  return { ...fields, ...breakErrors(resolved, span) };
}

/** Save turns into Retry after a failure the same tap may get past. */
export function correctionSave({
  steps,
  errors,
  saving,
  closed,
  failure,
}: {
  steps: CorrectionStep[];
  errors: CorrectionErrors;
  saving: boolean;
  closed: boolean;
  failure: EntryFailure | null;
}): { enabled: boolean; retry: boolean } {
  const invalid = Boolean(errors.startedAt ?? errors.endedAt ?? errors.breaks);
  return {
    enabled: steps.length > 0 && !invalid && !saving && !closed,
    retry: failure?.kind === "network" || failure?.kind === "server",
  };
}
