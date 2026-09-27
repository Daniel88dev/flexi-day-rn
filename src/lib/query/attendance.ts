import type { QueryClient } from "@tanstack/react-query";

import { qk } from "./keys";

// Prefixes, not keys: the clock reads unscoped and writes with the organization that read named,
// so an exact key would miss the entry the screens subscribe to. The same prefixes as the web.
const ATTENDANCE_READS = ["attendance-state", "attendance-month", "attendance-day"] as const;

export type Reread = { arrived: true } | { arrived: false; error: unknown };

/**
 * After one of the phone's own clock writes: every attendance read goes stale, and the clock's
 * own `/current` read answers again before this returns.
 */
export async function rereadAttendance(queryClient: QueryClient): Promise<Reread> {
  await Promise.all(
    ATTENDANCE_READS.map((prefix) =>
      queryClient.invalidateQueries({
        queryKey: [prefix],
        refetchType: prefix === "attendance-state" ? "all" : "active",
      })
    )
  );
  const state = queryClient.getQueryState(qk.attendanceState());
  return state?.status === "success" ? { arrived: true } : { arrived: false, error: state?.error };
}

/**
 * After a self-service write, whether it landed or not: the attendance reads again, and each
 * session's events, since a write of several requests can land in part.
 */
export async function rereadAfterSelfService(queryClient: QueryClient): Promise<Reread> {
  const [reread] = await Promise.all([
    rereadAttendance(queryClient),
    queryClient.invalidateQueries({ queryKey: qk.attendanceEventsAll() }),
  ]);
  return reread;
}
