import { useCallback, useSyncExternalStore } from "react";

import { PENDING_CHANGES_CHANNEL } from "./events";
import { activePendingChanges, type OverlayEntry, type PendingChange } from "./pending";
import { activeStoreRuntime } from "./runtime";

function usePendingSnapshot<TSnapshot>(read: () => TSnapshot): TSnapshot {
  const runtime = activeStoreRuntime();
  const subscribe = useCallback(
    (onChange: () => void) => runtime.events.subscribe([PENDING_CHANGES_CHANNEL], onChange),
    [runtime]
  );
  return useSyncExternalStore(subscribe, read);
}

/** Every write in flight, as a list that keeps its identity until a change moves. */
export function usePendingChanges(): readonly PendingChange[] {
  return usePendingSnapshot(activePendingChanges().list);
}

/** What merged reads lay over the stored rows: the writes in flight and the marked Provisional rows. */
export function useStoreOverlay(): readonly OverlayEntry[] {
  return usePendingSnapshot(activePendingChanges().overlay);
}
