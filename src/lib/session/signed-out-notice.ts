import { useSyncExternalStore } from "react";

// The signed-out wipe runs outside React — a 401 from a request, a foreground lookup — so what
// it leaves for welcome to show is held here rather than in a provider.
let showing = false;
const listeners = new Set<() => void>();

function announce(next: boolean): void {
  if (showing === next) return;
  showing = next;
  for (const listener of [...listeners]) listener();
}

/** What the signed-out wipe leaves behind: welcome says why the phone is signed out. */
export function showSignedOutNotice(): void {
  announce(true);
}

export function clearSignedOutNotice(): void {
  announce(false);
}

export function signedOutNoticeShowing(): boolean {
  return showing;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSignedOutNotice(): boolean {
  return useSyncExternalStore(subscribe, signedOutNoticeShowing);
}
