import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

/** Android's `Modal` never calls `onDismiss`, so the hand-off waits out the slide instead. */
export const SHEET_DISMISS_MS = 400;

/**
 * Closes a sheet and runs what comes next once it has gone: iOS skips a modal presented while
 * another is still hiding. Pass `onDismiss` to the sheet's `Modal`.
 */
export function useAfterDismiss(close: () => void) {
  const pendingRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const onDismiss = useCallback(() => {
    const run = pendingRef.current;
    pendingRef.current = null;
    run?.();
  }, []);

  const closeThen = (run: () => void) => {
    pendingRef.current = run;
    close();
    if (Platform.OS !== "ios") timerRef.current = setTimeout(onDismiss, SHEET_DISMISS_MS);
  };

  return { closeThen, onDismiss };
}
