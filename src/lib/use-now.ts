import { useEffect, useState } from "react";

/** The wall clock as state, so a relative time re-renders on its own instead of going stale. */
export function useNow(tickMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const ticking = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(ticking);
  }, [tickMs]);

  return now;
}
