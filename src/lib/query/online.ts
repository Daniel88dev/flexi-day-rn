import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const isOnline = () => onlineManager.isOnline();
const subscribe = (listener: () => void) => onlineManager.subscribe(listener);

/** What the online manager says, which `QueryLayer` feeds from the phone's network. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline);
}
