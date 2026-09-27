import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { haptic } from "@/lib/haptics";
import { apiRequest, qk, rereadAttendance } from "@/lib/query";

import { clockView, type ClockView } from "./clock";
import type { LocationEnd } from "./location-capture";
import { hapticForNotice, noticeForFailure, settleNotice, type ClockAction } from "./notice";
import type { WriteNotice } from "./notice";
import type { AttendanceState } from "./types";

const CURRENT = "/api/attendance/current";

const WRITE_PATHS: Record<ClockAction, string> = {
  "clock-in": "/api/attendance/clock-in",
  "clock-out": "/api/attendance/clock-out",
  "break-start": "/api/attendance/break/start",
  "break-end": "/api/attendance/break/end",
};

const LOCATION_ENDS: Partial<Record<ClockAction, LocationEnd>> = {
  "clock-in": "IN",
  "clock-out": "OUT",
};

const isOnline = () => onlineManager.isOnline();
const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener);

/**
 * The clock as the query cache holds it, read without an organization as the web does. A screen
 * that opens the clock reads it again on mount however fresh the answer is.
 */
export function useClockRead({ rereadOnMount = false } = {}): {
  view: ClockView;
  reread: () => void;
} {
  const query = useQuery({
    queryKey: qk.attendanceState(),
    queryFn: ({ signal }) => apiRequest<AttendanceState>(CURRENT, { signal }),
    refetchOnMount: rereadOnMount ? "always" : true,
  });
  const online = useSyncExternalStore(subscribeOnline, isOnline);
  const { refetch } = query;
  const reread = useCallback(() => void refetch(), [refetch]);
  return {
    view: clockView({
      data: query.data,
      error: query.error,
      readAt: query.dataUpdatedAt,
      online,
    }),
    reread,
  };
}

/**
 * The four clock writes, none of them optimistic. The pressed action stays busy until the re-read
 * of `/current` lands, and every other action waits with it. Every write reads again, failed or
 * not: a write that got no answer may still have landed, and the re-read shows which.
 */
export function useClockWrites(
  organizationId: string | null,
  onClocked?: (end: LocationEnd, sessionId: string) => void
) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<ClockAction | null>(null);
  const [notice, setNotice] = useState<WriteNotice | null>(null);
  const inFlightRef = useRef(false);

  const act = useCallback(
    async (action: ClockAction) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(action);
      setNotice(null);
      haptic("tap");

      try {
        let failed: WriteNotice | null = null;
        let written: { id?: string } | undefined;
        try {
          written = await apiRequest<{ id?: string }>(WRITE_PATHS[action], {
            method: "POST",
            body: organizationId ? { organizationId } : {},
          });
        } catch (failure) {
          failed = noticeForFailure(action, failure);
          // A 401 has already gone to the signed-out wipe.
          if (!failed) return;
        }

        const end = LOCATION_ENDS[action];
        if (!failed && end && written?.id) onClocked?.(end, written.id);

        const settled = settleNotice(failed, await rereadAttendance(queryClient));
        haptic(settled ? hapticForNotice(settled) : "success");
        setNotice(settled);
      } finally {
        inFlightRef.current = false;
        setBusy(null);
      }
    },
    [organizationId, queryClient, onClocked]
  );

  return { busy, notice, act };
}
