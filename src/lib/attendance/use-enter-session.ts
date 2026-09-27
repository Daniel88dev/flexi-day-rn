import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { haptic } from "@/lib/haptics";
import { apiRequest, rereadAfterSelfService } from "@/lib/query";

import { entryFailureOf, type EntryFailure } from "./refusals";
import type { AttendanceBreakSpan, AttendanceSession } from "./types";

export type AttendanceEntry = {
  organizationId: string;
  businessDate: string;
  startedAt: string;
  endedAt: string;
  /** Saved in the same request: one refused break refuses the whole entry. */
  breaks?: AttendanceBreakSpan[];
};

/**
 * Enters a session, then reads `/current`, `/day`, `/month` and events again whether it landed or
 * not. The haptics are the Clock sheet's: success, a warning for a refusal, an error for no answer.
 */
export function useEnterSession() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<EntryFailure | null>(null);
  const inFlightRef = useRef(false);

  const save = useCallback(
    async (entry: AttendanceEntry): Promise<AttendanceSession | null> => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      setSaving(true);
      setFailure(null);
      haptic("tap");

      let saved: AttendanceSession | null = null;
      let failed: EntryFailure | null = null;
      try {
        saved = await apiRequest<AttendanceSession>("/api/attendance/sessions", {
          method: "POST",
          body: entry,
        });
      } catch (caught) {
        failed = entryFailureOf(caught);
      }

      try {
        await rereadAfterSelfService(queryClient);
      } finally {
        inFlightRef.current = false;
        setSaving(false);
      }

      if (saved) haptic("success");
      else if (failed) haptic(failed.kind === "refused" ? "warning" : "error");
      setFailure(failed);
      return saved;
    },
    [queryClient]
  );

  return { save, saving, failure };
}
