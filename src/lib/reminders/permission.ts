/** `unknown` until the first read answers. */
export type NotificationPermission = "unknown" | "undetermined" | "granted" | "denied";

export type PermissionApi = {
  get(): Promise<Exclude<NotificationPermission, "unknown">>;
  request(): Promise<Exclude<NotificationPermission, "unknown">>;
};

export type PermissionSource = {
  read(): NotificationPermission;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<NotificationPermission>;
  /** The iOS prompt, which only shows while undetermined; otherwise the recorded answer. */
  request(): Promise<NotificationPermission>;
};

export function createPermissionSource(api: PermissionApi): PermissionSource {
  let value: NotificationPermission = "unknown";
  const listeners = new Set<() => void>();
  const settle = (next: NotificationPermission) => {
    if (next === value) return next;
    value = next;
    for (const listener of [...listeners]) listener();
    return next;
  };
  const run = (ask: () => Promise<NotificationPermission>) =>
    ask().then(settle, (error: unknown) => {
      console.warn("The notification permission could not be read.", error);
      return value;
    });

  return {
    read: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: () => run(api.get),
    request: () => run(api.request),
  };
}
