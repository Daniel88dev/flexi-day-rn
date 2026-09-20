import { expoClient } from "@better-auth/expo/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { API_URL } from "@/lib/api";

import { attachClientHeaders } from "./client-headers";

/** What the expo plugin names its Keychain entries after: the cookie jar and the session cache. */
export const STORAGE_PREFIX = "flexi-day";

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
