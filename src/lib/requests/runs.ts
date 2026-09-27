import { dayNumber } from "@/lib/days";
import type { CalendarRecordType, ListedVacation, VacationStatus } from "@/lib/local-store";

/**
 * One card of the Requests list: contiguous days of one person, group, type, status, times and
 * half day, collapsed the way the web's `groupVacationRequests` does. A run is not a Request in the
 * glossary's sense (one submission sharing a `requestId`): it ignores `requestId`, so one Request
 * that was partly decided splits into several runs, and two Requests on adjacent days can share
 * one. Attachments hang off `requestId`, so a run cannot own them.
 */
export type RequestRun = {
  id: string;
  userId: string;
  userName: string | null;
  groupId: string;
  groupName: string | null;
  vacationType: CalendarRecordType;
  status: VacationStatus;
  from: string;
  to: string;
  startTime: string | null;
  endTime: string | null;
  halfDay: boolean;
  vacationIds: string[];
  /** Calendar days in the run, not allowance days. */
  dayCount: number;
  /** A pending change holds at least one of its days, so the card waits until it lifts. */
  pending: boolean;
};

/** What a run shares on every day: contiguous days with the same key are one run. */
export function runKey(
  row: Pick<
    ListedVacation,
    "userId" | "groupId" | "vacationType" | "status" | "startTime" | "endTime" | "halfDay"
  >
): string {
  return [
    row.userId,
    row.groupId,
    row.vacationType,
    row.status,
    row.startTime ?? "",
    row.endTime ?? "",
    String(row.halfDay),
  ].join("|");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function collapseRuns(rows: readonly ListedVacation[]): RequestRun[] {
  const sorted = rows
    .map((row) => ({ row, key: runKey(row) }))
    .sort(
      (left, right) =>
        compare(left.key, right.key) || compare(left.row.requestedDay, right.row.requestedDay)
    );

  const runs: RequestRun[] = [];
  let current: RequestRun | null = null;
  let currentKey: string | null = null;
  let lastDay: number | null = null;

  for (const { row, key } of sorted) {
    const dayOf = dayNumber(row.requestedDay);
    const contiguous = current !== null && key === currentKey && dayOf - (lastDay ?? 0) === 1;

    if (current && contiguous) {
      current.to = row.requestedDay;
      current.vacationIds.push(row.id);
      current.dayCount += 1;
      current.pending ||= row.pending;
    } else {
      current = {
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        groupId: row.groupId,
        groupName: row.groupName,
        vacationType: row.vacationType,
        status: row.status,
        from: row.requestedDay,
        to: row.requestedDay,
        startTime: row.startTime,
        endTime: row.endTime,
        halfDay: row.halfDay,
        vacationIds: [row.id],
        dayCount: 1,
        pending: row.pending,
      };
      runs.push(current);
    }
    currentKey = key;
    lastDay = dayOf;
  }

  return runs.sort(
    (left, right) =>
      compare(left.from, right.from) ||
      compare(left.groupId, right.groupId) ||
      compare(left.userId, right.userId)
  );
}
