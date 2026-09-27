import { focusManager, onlineManager } from "@tanstack/react-query";
import type { AppStateStatus } from "react-native";

type Subscription = { remove(): void };

export type AppStateEvents = {
  addEventListener(type: "change", listener: (state: AppStateStatus) => void): Subscription;
};

type NetworkState = { isConnected?: boolean; isInternetReachable?: boolean };

export type NetworkSource = {
  addNetworkStateListener(listener: (state: NetworkState) => void): Subscription;
  getNetworkStateAsync(): Promise<NetworkState>;
};

const isOnline = (state: NetworkState) => state.isInternetReachable ?? state.isConnected ?? true;

/**
 * Coming back to the foreground is focus, so stale queries re-read then; losing the internet
 * pauses them. Both managers are TanStack's globals, so this returns the way to let go of them.
 */
export function connectQueryManagers({
  appState,
  network,
}: {
  appState: AppStateEvents;
  network: NetworkSource;
}): () => void {
  focusManager.setEventListener((setFocused) => {
    const subscription = appState.addEventListener("change", (state) =>
      setFocused(state === "active")
    );
    return () => subscription.remove();
  });

  onlineManager.setEventListener((setOnline) => {
    // The listener only reports changes; the first read says where the phone starts, unless a
    // change has already answered that.
    let changed = false;
    const subscription = network.addNetworkStateListener((state) => {
      changed = true;
      setOnline(isOnline(state));
    });
    network.getNetworkStateAsync().then(
      (state) => changed || setOnline(isOnline(state)),
      () => undefined
    );
    return () => subscription.remove();
  });

  return () => {
    focusManager.setEventListener(() => undefined);
    onlineManager.setEventListener(() => undefined);
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  };
}
