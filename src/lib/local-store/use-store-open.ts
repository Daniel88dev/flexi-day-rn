import { useCallback, useSyncExternalStore } from "react";

import { activeStoreRuntime } from "./runtime";

/** Whether the store is open: false until the shell opens it, and false again once it is destroyed. */
export function useStoreOpen(): boolean {
  const runtime = activeStoreRuntime();
  const subscribe = useCallback(
    (onChange: () => void) => runtime.lifecycle.subscribeOpen(onChange),
    [runtime]
  );
  return useSyncExternalStore(subscribe, runtime.isOpen);
}
