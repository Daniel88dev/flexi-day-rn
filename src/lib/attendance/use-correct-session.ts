import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { haptic } from "@/lib/haptics";
import { apiRequest, rereadAfterSelfService } from "@/lib/query";

import { runCorrection, type CorrectionStep, type LandedStep } from "./correction-sheet";
import { entryFailureOf, type EntryFailure } from "./refusals";
import type { AttendanceSession } from "./types";

function send(step: CorrectionStep): Promise<AttendanceSession> {
  switch (step.kind) {
    case "delete-break":
      return apiRequest(`/api/attendance/breaks/${step.breakId}`, { method: "DELETE" });
    case "patch-session":
      return apiRequest(`/api/attendance/sessions/${step.sessionId}`, {
        method: "PATCH",
        body: step.patch,
      });
    case "patch-break":
      return apiRequest(`/api/attendance/breaks/${step.breakId}`, {
        method: "PATCH",
        body: step.patch,
      });
    case "add-break":
      return apiRequest(`/api/attendance/sessions/${step.sessionId}/breaks`, {
        method: "POST",
        body: step.span,
      });
  }
}

/**
 * The correction sheet's writes. Each reads `/current`, `/day`, `/month` and events again whether
 * it landed or not, since a Save is several requests and can land in part. The haptics are the
 * Clock sheet's.
 */
export function useCorrectSession() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<EntryFailure | null>(null);
  const inFlightRef = useRef(false);

  const write = useCallback(
    async <T>(work: () => Promise<{ result: T; failure: unknown }>): Promise<T | null> => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      setSaving(true);
      setFailure(null);
      haptic("tap");

      const { result, failure: caught } = await work();
      const failed = caught === null ? null : entryFailureOf(caught);

      try {
        await rereadAfterSelfService(queryClient);
      } finally {
        inFlightRef.current = false;
        setSaving(false);
      }

      if (caught === null) haptic("success");
      else if (failed) haptic(failed.kind === "refused" ? "warning" : "error");
      setFailure(failed);
      return result;
    },
    [queryClient]
  );

  const save = useCallback(
    async (steps: CorrectionStep[]): Promise<{ saved: boolean; landed: LandedStep[] } | null> =>
      write(async () => {
        const { landed, failure: caught } = await runCorrection(steps, send);
        return { result: { saved: caught === null, landed }, failure: caught };
      }),
    [write]
  );

  const remove = useCallback(
    async (sessionId: string): Promise<boolean> =>
      (await write(async () => {
        try {
          await apiRequest(`/api/attendance/sessions/${sessionId}`, { method: "DELETE" });
          return { result: true, failure: null };
        } catch (caught) {
          return { result: false, failure: caught };
        }
      })) ?? false,
    [write]
  );

  return { save, remove, saving, failure };
}
