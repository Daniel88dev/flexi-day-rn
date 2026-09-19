import { useEffect, useMemo, useRef, useState } from "react";

import type { StoreDatabase } from "./adapter";
import type { StoreChannel } from "./events";
import { activeStoreRuntime } from "./runtime";

/**
 * Reads the local store and re-reads when one of `channels` is announced — a committed
 * transaction touching that table, or the pending-change overlay moving — or when `build`
 * changes: memoize `build` so a screen re-reads on its own inputs and nothing else.
 */
export function useStoreQuery<TResult>(
  build: (db: StoreDatabase) => TResult,
  channels: readonly StoreChannel[]
): TResult {
  const runtime = activeStoreRuntime();
  const subscribed = useRef(channels);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    subscribed.current = channels;
  });

  const key = [...channels].sort().join(",");
  useEffect(() => {
    // A wipe can land while this is still mounted, and a read of the closed file would throw.
    const reread = () => {
      if (runtime.isOpen()) setVersion((current) => current + 1);
    };
    // A transaction committing between the first render and this effect would otherwise be missed.
    reread();
    return runtime.events.subscribe(subscribed.current, reread);
  }, [runtime, key]);

  // The rows change behind React's back, so the version stands in for them as a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => build(runtime.getDatabase()), [build, runtime, version]);
}
