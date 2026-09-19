import { useCallback, useSyncExternalStore } from "react";

import { PENDING_CHANGES_CHANNEL } from "./events";
import { activePendingChanges, type PendingChange } from "./pending";
import { activeStoreRuntime } from "./runtime";

/** Every write in flight, as a list that keeps its identity until a change moves. */
export function usePendingChanges(): readonly PendingChange[] {
  const runtime = activeStoreRuntime();
  const pending = activePendingChanges();

  const subscribe = useCallback(
    (onChange: () => void) => runtime.events.subscribe([PENDING_CHANGES_CHANNEL], onChange),
    [runtime]
  );

  return useSyncExternalStore(subscribe, pending.list);
}
