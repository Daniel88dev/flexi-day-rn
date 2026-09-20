import { authClient } from "./auth-client";

/** Only what signing out reads of the answer: the auth client's own shape is a union per plugin. */
export type EndSession = () => Promise<{ error?: unknown } | undefined>;

const endSessionThroughAuthClient: EndSession = () => authClient.signOut();

/**
 * What the More sheet's sign-out does: the server ends the session, then the phone lets go of it
 * either way. A server that refuses or never answers leaves a row behind, not a signed-in phone.
 */
export async function signOut(
  wipe: () => Promise<void>,
  endSession: EndSession = endSessionThroughAuthClient
): Promise<void> {
  try {
    const answer = await endSession();
    if (answer?.error) console.error("The server refused the sign-out.", answer.error);
  } catch (cause: unknown) {
    console.error("The sign-out request failed.", cause);
  }

  await wipe();
}
