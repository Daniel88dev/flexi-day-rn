import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createVacation, pull, type CreateOutcome, type VacationDraft } from "@/lib/local-store";

import { classifyFailure } from "./failure";
import { qk } from "./keys";
import { rereadAfterVacationWrite } from "./vacation-detail";

/**
 * A booking, as the new-request form sends it. The form shows its own failures inline, so nothing
 * here toasts; a refusal still reads the group again and pulls, as every refusal does.
 */
export function useCreateRequest() {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (draft: VacationDraft): Promise<CreateOutcome> => {
    setSubmitting(true);
    try {
      const outcome = await createVacation(draft);
      if (outcome.ok) {
        void rereadAfterVacationWrite(queryClient);
      } else if (classifyFailure(outcome).kind === "refusal") {
        void queryClient.invalidateQueries({ queryKey: qk.group(draft.groupId) });
        void pull("refresh").catch(() => undefined);
      }
      return outcome;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, submit };
}
