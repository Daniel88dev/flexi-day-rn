import { useEffect } from "react";

import { deviceAppState, type AppStateSource } from "@/lib/app-state";

import { authClient } from "./auth-client";

const UNAUTHORIZED = 401;

/** Only what the revalidation reads of the answer: a session, or a reason there is none. */
export type SessionLookup = () => Promise<{
  data?: unknown;
  error?: { status?: number } | null;
}>;

const lookupThroughAuthClient: SessionLookup = () => authClient.getSession();

/**
 * What the server still says about the session the phone is showing. Only an answer that
 * arrived and carries no session signs the phone out: a server that faults or never replies
 * says nothing about it.
 */
export async function revalidateSession(
  lookup: SessionLookup,
  wipe: () => Promise<void>
): Promise<void> {
  let answer;
  try {
    answer = await lookup();
  } catch (cause: unknown) {
    console.error("The session lookup failed.", cause);
    return;
  }

  if (answer.data) return;

  const status = answer.error?.status;
  if (status != null && status !== UNAUTHORIZED) {
    console.error("The session lookup answered with an error.", answer.error);
    return;
  }

  await wipe();
}

export type SessionRevalidationOptions = {
  /** Off while the shell has no viewer of its own: a visitor on their way to welcome. */
  enabled?: boolean;
  lookup?: SessionLookup;
  appState?: AppStateSource;
};

/**
 * The session's half of a foreground: the same event the sync pull runs on, subscribed to
 * separately so neither waits for the other. The cold start revalidates as it renders.
 */
export function useSessionRevalidation(
  wipe: () => Promise<void>,
  {
    enabled = true,
    lookup = lookupThroughAuthClient,
    appState = deviceAppState,
  }: SessionRevalidationOptions = {}
): void {
  useEffect(() => {
    if (!enabled) return;
    void revalidateSession(lookup, wipe);
    return appState.subscribe(() => void revalidateSession(lookup, wipe));
  }, [appState, enabled, lookup, wipe]);
}
