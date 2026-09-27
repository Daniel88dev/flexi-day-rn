import type { AttendanceSession } from "./types";

export type SessionMark =
  | { kind: "entered" }
  | { kind: "changed" }
  | { kind: "auto-closed" }
  /** Overdue once its day has passed: today it is somebody at work, afterwards a flag. */
  | { kind: "still-open"; overdue: boolean };

/**
 * What sits above one session on the Day view. A break the sweep closed is flagged on its own row
 * instead, so only the session's own close counts here.
 */
export function sessionMarks(session: AttendanceSession, today: string): SessionMark[] {
  const marks: SessionMark[] = [];
  if (session.origin === "ENTERED") marks.push({ kind: "entered" });
  if (session.changedAfterDay) marks.push({ kind: "changed" });
  if (session.closedBy === "SWEEP") marks.push({ kind: "auto-closed" });
  if (session.open) marks.push({ kind: "still-open", overdue: session.businessDate !== today });
  return marks;
}
