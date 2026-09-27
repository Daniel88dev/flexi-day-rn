import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * Coming back to a screen reads its keys again, as the foreground does for the whole app. The first
 * focus is the mount, which has just read them.
 */
export function useRereadOnFocus(queryKeys: readonly QueryKey[]): void {
  const queryClient = useQueryClient();
  const keysRef = useRef(queryKeys);
  const focusedBeforeRef = useRef(false);

  useEffect(() => {
    keysRef.current = queryKeys;
  });

  useFocusEffect(
    useCallback(() => {
      if (!focusedBeforeRef.current) {
        focusedBeforeRef.current = true;
        return;
      }
      for (const queryKey of keysRef.current) void queryClient.invalidateQueries({ queryKey });
    }, [queryClient])
  );
}
