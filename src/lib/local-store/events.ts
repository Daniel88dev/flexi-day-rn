import type { StoreTableName } from "./schema";

export type StoreListener = (tables: ReadonlySet<StoreTableName>) => void;

export type StoreEvents = {
  emit(tables: Iterable<StoreTableName>): void;
  subscribe(tables: Iterable<StoreTableName>, listener: StoreListener): () => void;
};

function overlaps(subscribed: ReadonlySet<StoreTableName>, emitted: ReadonlySet<StoreTableName>) {
  for (const table of emitted) {
    if (subscribed.has(table)) return true;
  }
  return false;
}

/**
 * The store's own change notification. SQLite's database change listener stays off: it misses
 * joins and truncates and coalesces nothing, so committed transactions announce their own tables.
 */
export function createStoreEvents(): StoreEvents {
  const subscriptions = new Set<{ tables: ReadonlySet<StoreTableName>; listener: StoreListener }>();
  let pending: Set<StoreTableName> | null = null;

  const flush = () => {
    const emitted = pending;
    pending = null;
    if (!emitted) return;
    for (const subscription of [...subscriptions]) {
      if (overlaps(subscription.tables, emitted)) subscription.listener(emitted);
    }
  };

  return {
    emit(tables) {
      if (!pending) {
        pending = new Set();
        queueMicrotask(flush);
      }
      for (const table of tables) pending.add(table);
    },

    subscribe(tables, listener) {
      const subscription = { tables: new Set(tables), listener };
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
      };
    },
  };
}
