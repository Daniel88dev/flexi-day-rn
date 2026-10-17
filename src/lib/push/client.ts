import type { NotificationPermission } from "@/lib/reminders/permission";

import type { PushEnvironment } from "./environment";

export type PushRegistration = { token: string; environment: PushEnvironment };

export type PushApi = {
  upsert(registration: PushRegistration): Promise<void>;
  remove(): Promise<void>;
};

export type PushDevice = {
  token(): Promise<string>;
  environment(): Promise<PushEnvironment>;
  /** Unregisters from APNs, clears the badge, the delivered notices and the last tapped one. */
  unregister(): Promise<void>;
  setBadge(count: number): Promise<void>;
};

export type PushRegistrar = {
  /** A signed-in shell is up. Syncs run from here until the next `unregister`. */
  signedIn(): void;
  /** Run on every foreground, cold start included. One asked for during the wipe waits for it. */
  sync(permission: NotificationPermission): Promise<void>;
  /** The Signed-out wipe's step. It works offline, where telling the server would not. */
  unregister(): Promise<void>;
  /** Does nothing once the wipe has started, so a late read cannot bring the badge back. */
  setBadge(count: number): Promise<void>;
};

/**
 * Keeps the server's Push registration in step with what iOS allows. The upsert is idempotent,
 * and a password change or two-factor toggle swaps the session and drops the row, so every
 * granted sync sends it again. A revoked permission deletes it once, until permission comes back.
 */
export function createPushRegistrar({
  api,
  device,
}: {
  api: PushApi;
  device: PushDevice;
}): PushRegistrar {
  let deleted = false;
  // A sync that started before the wipe must not hand the next user's server this phone's token.
  let generation = 0;
  let signedInAt: number | null = null;
  let running: { permission: NotificationPermission; done: Promise<void> } | null = null;
  let unregistering: Promise<void> | null = null;
  let waiting: NotificationPermission | null = null;
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
      await api.upsert({ token, environment });
    } else if (permission === "denied" && !deleted) {
      await api.remove();
      deleted = true;
    }
  };

  const sync = (permission: NotificationPermission): Promise<void> => {
    if (unregistering) {
      waiting = permission;
      return unregistering;
    }
    if (signedInAt !== generation) return Promise.resolve();
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
  };

  return {
    signedIn() {
      signedInAt = generation;
    },

    sync,

    async setBadge(count) {
      if (signedInAt !== generation || unregistering) return;
      await device.setBadge(count);
    },

    unregister() {
      generation += 1;
      deleted = false;
      running = null;
      waiting = null;
      // Fetching a token registers with APNs, so the unregister has to come after it.
      const done = (fetchingToken ?? Promise.resolve())
        .catch(() => {})
        .then(() => device.unregister());
      const settled = done
        .catch(() => {})
        .then(() => {
          if (unregistering !== settled) return;
          unregistering = null;
          const permission = waiting;
          waiting = null;
          return permission ? sync(permission) : undefined;
        });
      unregistering = settled;
      return done;
    },
  };
}
