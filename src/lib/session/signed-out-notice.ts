import { useSyncExternalStore } from "react";

/** Why welcome says the phone is signed out. */
export type SignedOutNotice = "signed-out" | "account-deleted";

// The signed-out wipe runs outside React — a 401 from a request, a foreground lookup — so what
// it leaves for welcome to show is held here rather than in a provider.
let showing: SignedOutNotice | null = null;
const listeners = new Set<() => void>();

function announce(next: SignedOutNotice | null): void {
  if (showing === next) return;
  showing = next;
  for (const listener of [...listeners]) listener();
}

/**
 * What the signed-out wipe leaves behind: welcome says why the phone is signed out. A 401 that
 * lands after a deletion is the deletion's, so it does not turn "deleted" back into "signed out".
 */
export function showSignedOutNotice(notice: SignedOutNotice = "signed-out"): void {
  if (showing === "account-deleted") return;
  announce(notice);
}

export function clearSignedOutNotice(): void {
  announce(null);
}

export function signedOutNotice(): SignedOutNotice | null {
  return showing;
}

export function signedOutNoticeShowing(): boolean {
  return showing !== null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSignedOutNotice(): SignedOutNotice | null {
  return useSyncExternalStore(subscribe, signedOutNotice);
}
