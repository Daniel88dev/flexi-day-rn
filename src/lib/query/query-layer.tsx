import { QueryClientProvider } from "@tanstack/react-query";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { useEffect, type ReactNode } from "react";
import { AppState } from "react-native";

import { connectQueryManagers } from "./managers";
import { queryClient, setUnauthorizedHandler } from "./runtime";

/**
 * The signed-in shell's query layer: foreground is focus, the network decides online, and a 401
 * from any request reaches the Signed-out wipe the shell hands in.
 */
export function QueryLayer({
  onUnauthorized,
  children,
}: {
  onUnauthorized: () => void;
  children: ReactNode;
}) {
  useEffect(
    () =>
      connectQueryManagers({
        appState: AppState,
        network: { addNetworkStateListener, getNetworkStateAsync },
      }),
    []
  );

  useEffect(() => setUnauthorizedHandler(onUnauthorized), [onUnauthorized]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
