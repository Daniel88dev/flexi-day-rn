import { useEffect, useMemo, useRef, useState } from "react";

import type { StoreDatabase } from "./adapter";
import { activeStoreRuntime } from "./runtime";
import type { StoreTableName } from "./schema";

/**
 * Reads the local store and re-reads when a committed transaction touches one of `tables`, or
 * when `build` changes: memoize `build` so a screen re-reads on its own inputs and nothing else.
 */
export function useStoreQuery<TResult>(
  build: (db: StoreDatabase) => TResult,
  tables: readonly StoreTableName[]
): TResult {
  const runtime = activeStoreRuntime();
  const subscribed = useRef(tables);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    subscribed.current = tables;
  });

  const key = [...tables].sort().join(",");
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
