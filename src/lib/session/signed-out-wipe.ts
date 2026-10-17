import { storageAdapter } from "@better-auth/expo/client";
import { router } from "expo-router";
import { useCallback } from "react";

import { signOutGoogle as signOutGoogleSdk } from "@/lib/auth/providers/google";
import { destroyStore } from "@/lib/local-store";
import { pushRegistrar } from "@/lib/push/device";
import { queryClient } from "@/lib/query/runtime";
import { clearClockReminders } from "@/lib/reminders/device";

import { clearClientSession, SESSION_COOKIE_KEY } from "./auth-client";
import { keychain } from "./keychain";
import type { RootRoute } from "./root-route";
import { useSetRootRoute } from "./root-route-context";
import { SESSION_CACHE_KEY } from "./session-cache";
import { showSignedOutNotice, type SignedOutNotice } from "./signed-out-notice";

/** What the expo plugin reads an entry it holds nothing in as; deleting the key orphans chunks. */
const EMPTY_ENTRY = "{}";

export type SessionStorage = {
  setItemAsync(key: string, value: string): Promise<void>;
};

export type SignedOutWipeOptions = {
  setRootRoute: (route: RootRoute) => void;
  storage?: SessionStorage;
  destroyLocalStore?: () => Promise<void>;
  clearReminders?: () => Promise<void>;
  signOutGoogle?: () => Promise<void>;
  unregisterPush?: () => Promise<void>;
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
 * the server has been told: everything the phone holds for the user goes but the Device id, and
 * welcome says why. Push is let go of on the phone rather than the server, so a sign-out the
 * server never heard still stops the pushes. It never signs out on its own.
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
  clearReminders = clearClockReminders,
  signOutGoogle = signOutGoogleSdk,
  unregisterPush = pushRegistrar.unregister,
  clearSession = clearClientSession,
  showNotice = showSignedOutNotice,
  replace = (href) => router.replace(href as "/welcome"),
}: SignedOutWipeOptions): Promise<void> {
  try {
    await Promise.all([
      storage.setItemAsync(SESSION_COOKIE_KEY, EMPTY_ENTRY),
      storage.setItemAsync(SESSION_CACHE_KEY, EMPTY_ENTRY),
      destroyLocalStore(),
      clearReminders(),
      bestEffort(signOutGoogle, "The Google SDK did not sign out."),
      bestEffort(unregisterPush, "The phone did not unregister from push."),
    ]);
  } catch (cause: unknown) {
    // Whatever the phone could not let go of, staying on a signed-in screen is worse.
    console.error("The signed-out wipe did not finish.", cause);
  }

  queryClient.clear();
  clearSession();
  showNotice();
  setRootRoute("welcome");
  replace("/welcome");
}

// Settles on its own, so a failing step neither cuts short the wait on the others nor hides
// their failure.
async function bestEffort(step: () => Promise<void>, message: string): Promise<void> {
  try {
    await step();
  } catch (cause: unknown) {
    console.error(message, cause);
  }
}

/**
 * The wipe as the screens call it, carrying the root route the guards read. A deleted account
 * passes `"account-deleted"` so welcome says that instead.
 */
export function useSignedOutWipe(notice: SignedOutNotice = "signed-out"): () => Promise<void> {
  const setRootRoute = useSetRootRoute();
  return useCallback(
    () => signedOutWipe({ setRootRoute, showNotice: () => showSignedOutNotice(notice) }),
    [notice, setRootRoute]
  );
}
