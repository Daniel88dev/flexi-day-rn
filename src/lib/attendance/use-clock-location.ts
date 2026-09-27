import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { apiRequest } from "@/lib/query";

import {
  HIDDEN,
  captureLocation,
  nextLocationStatus,
  type LocationEnd,
  type LocationFix,
  type LocationStatus,
} from "./location-capture";
import { onLeavingApp, phoneLocation } from "./location-device";

type Stored = { applied: boolean; accuracy: number | null };

const sendFix = (sessionId: string) => async (fix: LocationFix) => {
  const stored = await apiRequest<Stored>(
    `/api/attendance/sessions/${encodeURIComponent(sessionId)}/location`,
    { method: "POST", body: fix }
  );
  return stored.accuracy;
};

// The same prefixes the web refreshes once its capture is over: the reads that show the fix.
const LOCATION_READS = ["attendance-state", "attendance-day"] as const;

/**
 * The Location fix after a clock-in or clock-out, fired and forgotten. The status line follows
 * the latest capture only; an earlier one still finishes and sends its fixes.
 */
export function useClockLocation(): {
  status: LocationStatus;
  capture: (end: LocationEnd, sessionId: string) => void;
} {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LocationStatus>(HIDDEN);
  const latestRef = useRef(0);

  const capture = useCallback(
    (end: LocationEnd, sessionId: string) => {
      const run = ++latestRef.current;
      setStatus(HIDDEN);
      void captureLocation({
        end,
        device: phoneLocation,
        send: sendFix(sessionId),
        onLeave: onLeavingApp,
        onEvent: (event) => {
          if (latestRef.current === run) setStatus((current) => nextLocationStatus(current, event));
        },
      }).then(() =>
        Promise.all(
          LOCATION_READS.map((prefix) => queryClient.invalidateQueries({ queryKey: [prefix] }))
        )
      );
    },
    [queryClient]
  );

  return { status, capture };
}
