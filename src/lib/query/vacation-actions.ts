import { useQueryClient } from "@tanstack/react-query";
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

export type VacationAction = "approve" | "reject" | "cancel" | "update";

export function useVacationActions(vacationId: string) {
  const queryClient = useQueryClient();
  const writeFailure = useWriteFailure();
  const [running, setRunning] = useState<VacationAction | null>(null);

  const run = async (action: VacationAction, write: () => Promise<WriteOutcome>) => {
    setRunning(action);
    try {
      const outcome = await write();
      if (!outcome.ok) {
        writeFailure(outcome, {
          queryKeys: [qk.vacation(vacationId), qk.myApprovals()],
          retry: () => void run(action, write),
        });
        return false;
      }
      await rereadAfterVacationWrite(queryClient);
      return true;
    } finally {
      setRunning(null);
    }
  };

  return {
    running,
    approve: (ids: string[]) => run("approve", () => approveVacations(ids)),
    reject: (ids: string[], reason?: string) => run("reject", () => rejectVacations(ids, reason)),
    cancel: (ids: string[], reason?: string) => run("cancel", () => cancelVacations(ids, reason)),
    update: (input: VacationUpdate) => run("update", () => updateVacation(input)),
  };
}
