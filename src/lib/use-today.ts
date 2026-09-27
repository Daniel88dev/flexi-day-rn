import { useEffect, useState } from "react";

import { deviceAppState, type AppStateSource } from "@/lib/app-state";

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * The current date as state, moving on at midnight and when the app comes back to the
 * foreground, since a suspended app misses its timers. It keeps its identity within a day.
 */
export function useToday(appState: AppStateSource = deviceAppState): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      setToday((current) => (sameDay(current, now) ? current : now));
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const untilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(
        () => {
          refresh();
          untilMidnight();
        },
        midnight.getTime() - now.getTime() + 1_000
      );
    };

    untilMidnight();
    const unsubscribe = appState.subscribe(refresh);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [appState]);

  return today;
}
