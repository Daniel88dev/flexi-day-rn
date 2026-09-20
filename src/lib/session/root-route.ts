import type { CachedSession } from "./session-cache";

/** Where a launch lands: nowhere until both reads are in, then the shell or the welcome screen. */
export type RootRoute = "wait" | "signed-in" | "welcome";

export type RootRouteInput = {
  deviceIdRead: boolean;
  /** `undefined` while the session cache has not been read yet, `null` once it read as empty. */
  cachedSession: CachedSession | null | undefined;
};

export function rootRoute({ deviceIdRead, cachedSession }: RootRouteInput): RootRoute {
  if (!deviceIdRead || cachedSession === undefined) return "wait";
  return cachedSession ? "signed-in" : "welcome";
}
