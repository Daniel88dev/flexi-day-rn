import type { StoreTableName } from "./schema";

/** The pending-change overlay lives in memory, so it announces itself on a channel of its own. */
export const PENDING_CHANGES_CHANNEL = "pendingChanges";

/** What a read can depend on: a table of the store, or the overlay laid over it. */
export type StoreChannel = StoreTableName | typeof PENDING_CHANGES_CHANNEL;

export type StoreListener = (channels: ReadonlySet<StoreChannel>) => void;

export type StoreEvents = {
  emit(channels: Iterable<StoreChannel>): void;
  subscribe(channels: Iterable<StoreChannel>, listener: StoreListener): () => void;
};

function overlaps(subscribed: ReadonlySet<StoreChannel>, emitted: ReadonlySet<StoreChannel>) {
  for (const channel of emitted) {
    if (subscribed.has(channel)) return true;
  }
  return false;
}

/**
 * The store's own change notification. SQLite's database change listener stays off: it misses
 * joins and truncates and coalesces nothing, so committed transactions announce their own tables.
 */
export function createStoreEvents(): StoreEvents {
  const subscriptions = new Set<{
    channels: ReadonlySet<StoreChannel>;
    listener: StoreListener;
  }>();
  let pending: Set<StoreChannel> | null = null;

  const flush = () => {
    const emitted = pending;
    pending = null;
    if (!emitted) return;
    for (const subscription of [...subscriptions]) {
      if (overlaps(subscription.channels, emitted)) subscription.listener(emitted);
    }
  };

  return {
    emit(channels) {
      if (!pending) {
        pending = new Set();
        queueMicrotask(flush);
      }
      for (const channel of channels) pending.add(channel);
    },

    subscribe(channels, listener) {
      const subscription = { channels: new Set(channels), listener };
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
      };
    },
  };
}
