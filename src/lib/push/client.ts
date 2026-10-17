import type { NotificationPermission } from "@/lib/reminders/permission";

import type { PushEnvironment } from "./environment";

export type PushRegistration = { token: string; environment: PushEnvironment };

export type PushApi = {
  register(registration: PushRegistration): Promise<void>;
  unregister(): Promise<void>;
};

export type PushDevice = {
  token(): Promise<string>;
  environment(): Promise<PushEnvironment>;
  /** Unregisters from APNs, clears the badge and takes delivered notices off the screen. */
  letGo(): Promise<void>;
};

export type PushClient = {
  /** Run on every foreground, cold start included, while signed in. */
  sync(permission: NotificationPermission): Promise<void>;
  /** The Signed-out wipe's step. It works offline, where telling the server would not. */
  letGo(): Promise<void>;
};

/**
 * Keeps the server's Push registration in step with what iOS allows. The upsert is idempotent,
 * and a password change or two-factor toggle swaps the session and drops the row, so every
 * granted sync sends it again. A revoked permission deletes it once, until permission comes back.
 */
export function createPushClient({
  api,
  device,
}: {
  api: PushApi;
  device: PushDevice;
}): PushClient {
  let deleted = false;
  // A sync that started before the wipe must not hand the next user's server this phone's token.
  let generation = 0;
  let running: { permission: NotificationPermission; done: Promise<void> } | null = null;
  let lettingGo: Promise<void> | null = null;
  let fetchingToken: Promise<unknown> | null = null;

  const step = async (permission: NotificationPermission, started: number) => {
    if (started !== generation) return;
    if (permission === "granted") {
      deleted = false;
      const fetching = device.token();
      fetchingToken = fetching;
      const token = await fetching.finally(() => {
        if (fetchingToken === fetching) fetchingToken = null;
      });
      const environment = await device.environment();
      if (started !== generation) return;
      await api.register({ token, environment });
    } else if (permission === "denied" && !deleted) {
      await api.unregister();
      deleted = true;
    }
  };

  return {
    sync(permission) {
      if (lettingGo) return Promise.resolve();
      if (running?.permission === permission) return running.done;
      const started = generation;
      const previous = running?.done ?? Promise.resolve();
      const done = previous
        .then(() => step(permission, started))
        .catch((error: unknown) => console.warn("The push registration did not sync.", error))
        .finally(() => {
          if (running?.done === done) running = null;
        });
      running = { permission, done };
      return done;
    },

    letGo() {
      generation += 1;
      deleted = false;
      // Fetching a token registers with APNs, so the unregister has to come after it.
      const done = (fetchingToken ?? Promise.resolve())
        .catch(() => {})
        .then(() => device.letGo())
        .finally(() => {
          lettingGo = null;
        });
      lettingGo = done;
      return done;
    },
  };
}
