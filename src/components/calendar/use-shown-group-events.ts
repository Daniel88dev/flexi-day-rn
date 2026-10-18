import { useMemo } from "react";

import { withRights, type ShownGroupEvent } from "@/lib/group-events/rights";
import type { CalendarGroupEvent, RequestListScope } from "@/lib/local-store";
import { useGroupEventRights } from "@/lib/query";
import type { YearMonth } from "@/lib/requests/months";

/** The Local store's group events with the server's word on who may change them. */
export function useShownGroupEvents(
  events: readonly CalendarGroupEvent[],
  month: YearMonth | null,
  scope: RequestListScope
): ShownGroupEvent[] {
  const rights = useGroupEventRights(month, scope);
  return useMemo(() => withRights(events, rights), [events, rights]);
}
