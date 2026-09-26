import { storageAdapter } from "@better-auth/expo/client";
import { router } from "expo-router";
import { useCallback } from "react";

import { destroyStore } from "@/lib/local-store";

import { clearClientSession, SESSION_COOKIE_KEY } from "./auth-client";
import { keychain } from "./keychain";
import type { RootRoute } from "./root-route";
import { useSetRootRoute } from "./root-route-context";
import { SESSION_CACHE_KEY } from "./session-cache";
import { showSignedOutNotice } from "./signed-out-notice";

/** What the expo plugin reads an entry it holds nothing in as; deleting the key orphans chunks. */
const EMPTY_ENTRY = "{}";

export type SessionStorage = {
  setItemAsync(key: string, value: string): Promise<void>;
};

export type SignedOutWipeOptions = {
  setRootRoute: (route: RootRoute) => void;
  storage?: SessionStorage;
  destroyLocalStore?: () => Promise<void>;
  clearSession?: () => void;
  showNotice?: () => void;
  replace?: (href: string) => void;
};

const sessionStorage: SessionStorage = storageAdapter(keychain);

// A foreground can answer twice at once — the sync pull's 401 and the session lookup — and one
// wipe is enough: the second caller waits on the first rather than closing the database again.
let running: Promise<void> | null = null;

/**
 * What the app does when the server stops trusting the phone, and what signing out does after
 * the server has been told: the cookie jar, the session cache and the Local store go, the Device
 * id stays, and welcome says why. It never signs out on its own.
 */
export function signedOutWipe(options: SignedOutWipeOptions): Promise<void> {
  running ??= wipe(options).finally(() => {
    running = null;
  });
  return running;
}

async function wipe({
  setRootRoute,
  storage = sessionStorage,
  destroyLocalStore = destroyStore,
  clearSession = clearClientSession,
  showNotice = showSignedOutNotice,
  replace = (href) => router.replace(href as "/welcome"),
}: SignedOutWipeOptions): Promise<void> {
  try {
    await Promise.all([
      storage.setItemAsync(SESSION_COOKIE_KEY, EMPTY_ENTRY),
      storage.setItemAsync(SESSION_CACHE_KEY, EMPTY_ENTRY),
      destroyLocalStore(),
    ]);
  } catch (cause: unknown) {
    // Whatever the phone could not let go of, staying on a signed-in screen is worse.
    console.error("The signed-out wipe did not finish.", cause);
  }

  clearSession();
  showNotice();
  setRootRoute("welcome");
  replace("/welcome");
}

/** The wipe as the screens call it, carrying the root route the guards read. */
export function useSignedOutWipe(): () => Promise<void> {
  const setRootRoute = useSetRootRoute();
  return useCallback(() => signedOutWipe({ setRootRoute }), [setRootRoute]);
}
