import { useSyncExternalStore } from "react";

let holders = 0;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of [...listeners]) listener();
};

/**
 * Asks for the privacy cover while something on screen must stay out of the app-switcher
 * snapshot, which iOS writes to disk. Returns the release; releasing twice is harmless.
 */
export function holdPrivacyCover(): () => void {
  holders += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    notify();
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const held = () => holders > 0;

export function usePrivacyCoverHeld(): boolean {
  return useSyncExternalStore(subscribe, held, held);
}
