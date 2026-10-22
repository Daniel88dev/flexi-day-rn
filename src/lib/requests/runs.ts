import type { ListedVacation, VacationStatus, WireRecordType } from "@/lib/local-store";

/**
 * One card of the Requests list: the days of one Request (`requestId`) that share a person, group,
 * type, status, times and half day, the web's `groupVacationRequests`. Membership never comes from
 * day adjacency: a Request skips weekends and holidays, and two Requests can sit on adjacent days.
 * A partly decided Request splits by status.
 */
export type RequestRun = {
  id: string;
  userId: string;
  userName: string | null;
  groupId: string;
  groupName: string | null;
  vacationType: WireRecordType;
  status: VacationStatus;
  from: string;
  to: string;
  startTime: string | null;
  endTime: string | null;
  halfDay: boolean;
  vacationIds: string[];
  /** Stored days in the run, a half day counted as one: the Request's working days. */
  dayCount: number;
  /** A pending change or a Provisional row holds one of its days, so the card waits. */
  pending: boolean;
};

/** What a run shares on every day. The calendar's bars join contiguous days by it alone. */
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
  const sorted = [...rows].sort((left, right) => compare(left.requestedDay, right.requestedDay));

  const runs = new Map<string, RequestRun>();
  for (const row of sorted) {
    const key = `${row.requestId}|${runKey(row)}`;
    const current = runs.get(key);
    if (current) {
      current.to = row.requestedDay;
      current.vacationIds.push(row.id);
      current.dayCount += 1;
      current.pending ||= row.pending;
      continue;
    }
    runs.set(key, {
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
    });
  }

  return [...runs.values()].sort(
    (left, right) =>
      compare(left.from, right.from) ||
      compare(left.groupId, right.groupId) ||
      compare(left.userId, right.userId)
  );
}
