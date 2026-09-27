import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";

import {
  approveVacations,
  cancelVacations,
  rejectVacations,
  updateVacation,
  type VacationUpdate,
  type WriteOutcome,
} from "@/lib/local-store";

import { qk } from "./keys";
import { useWriteFailure } from "./use-write-failure";
import { rereadAfterVacationWrite } from "./vacation-detail";

/**
 * One of the phone's vacation writes, as every screen runs it: `busy` names it while it is in
 * flight, a Retry from the failure toast included, a failure goes to the shared write-failure
 * handling with `queryKeys`, and a success reads the vacation reads again.
 */
export function useVacationWrite<TBusy>(queryKeys: readonly QueryKey[]) {
  const queryClient = useQueryClient();
  const writeFailure = useWriteFailure();
  const [busy, setBusy] = useState<TBusy | null>(null);

  const run = async (next: TBusy, write: () => Promise<WriteOutcome>): Promise<boolean> => {
    setBusy(next);
    try {
      const outcome = await write();
      if (!outcome.ok) {
        writeFailure(outcome, { queryKeys, retry: () => void run(next, write) });
        return false;
      }
      await rereadAfterVacationWrite(queryClient);
      return true;
    } finally {
      setBusy(null);
    }
  };

  return { busy, run };
}

export type VacationAction = "approve" | "reject" | "cancel" | "update";

export function useVacationActions(vacationId: string) {
  const { busy, run } = useVacationWrite<VacationAction>([
    qk.vacation(vacationId),
    qk.myApprovals(),
  ]);

  return {
    running: busy,
    approve: (ids: string[]) => run("approve", () => approveVacations(ids)),
    reject: (ids: string[], reason?: string) => run("reject", () => rejectVacations(ids, reason)),
    cancel: (ids: string[], reason?: string) => run("cancel", () => cancelVacations(ids, reason)),
    update: (input: VacationUpdate) => run("update", () => updateVacation(input)),
  };
}
