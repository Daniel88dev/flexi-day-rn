import { expoClient } from "@better-auth/expo/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { API_URL } from "@/lib/api";

import { attachClientHeaders } from "./client-headers";

/** What the expo plugin names its Keychain entries after: the cookie jar and the session cache. */
export const STORAGE_PREFIX = "flexi-day";

/** Where the expo plugin keeps the cookie jar; the signed-out wipe empties it. */
export const SESSION_COOKIE_KEY = `${STORAGE_PREFIX}_cookie`;

/**
 * The session's own client: it keeps the cookie jar and the session cache in the Keychain and
 * carries the same client headers the request wrapper sends.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    onRequest: (context) => {
      attachClientHeaders(context.headers);
      return context;
    },
  },
  plugins: [
    expoClient({ scheme: "flexiday", storagePrefix: STORAGE_PREFIX, storage: SecureStore }),
    twoFactorClient(),
  ],
});

export const sessionCookie = (): Promise<string> => authClient.getCookie();

/**
 * Drops the session the client holds in memory, which is what its own sign-out does and what
 * nothing else does: the Keychain going empty leaves `useSession()` answering the old viewer.
 */
export function clearClientSession(): void {
  const session = authClient.$store.atoms.session;
  session.set({ ...session.get(), data: null, error: null, isPending: false });
}
