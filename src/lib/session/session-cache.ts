import { storageAdapter } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

import { STORAGE_PREFIX } from "./auth-client";

/** Where the expo plugin writes the last session it saw; its own key, read here to route on. */
export const SESSION_CACHE_KEY = `${STORAGE_PREFIX}_session_data`;

export type CachedSession = { userId: string };

type CacheEntry = {
  user?: { id?: unknown } | null;
  session?: { id?: unknown; expiresAt?: unknown } | null;
};

/**
 * What the app takes the cached entry to mean, on the same terms the expo plugin restores it:
 * a user, a session and an expiry still ahead.
 */
export function parseCachedSession(raw: string | null, now: number): CachedSession | null {
  if (!raw) return null;

  let entry: CacheEntry;
  try {
    entry = JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }

  const userId = entry?.user?.id;
  const expiresAt = entry?.session?.expiresAt;
  if (typeof userId !== "string" || !userId) return null;
  if (!entry.session?.id || typeof expiresAt !== "string") return null;

  const expiry = Date.parse(expiresAt);
  return Number.isNaN(expiry) || expiry <= now ? null : { userId };
}

const storage = storageAdapter(SecureStore);

/** A Keychain that refuses to answer reads as no session: the app asks the person to sign in. */
export async function loadCachedSession(): Promise<CachedSession | null> {
  try {
    return parseCachedSession(await storage.getItemAsync(SESSION_CACHE_KEY), Date.now());
  } catch (error: unknown) {
    console.error("The cached session could not be read.", error);
    return null;
  }
}
