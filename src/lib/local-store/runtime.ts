import type { StoreAdapter, StoreDatabase } from "./adapter";
import { createStoreEvents, type StoreEvents } from "./events";
import { createStoreLifecycle, type StoreLifecycle } from "./lifecycle";
import type { StoreTableName } from "./schema";

export type StoreTransaction = {
  db: StoreDatabase;
  /** Records a table the transaction wrote, so the commit announces it on the event bus. */
  touch(table: StoreTableName): void;
};

export type StoreRuntime = {
  lifecycle: StoreLifecycle;
  events: StoreEvents;
  getDatabase(): StoreDatabase;
  /** Runs one synchronous transaction; on commit it emits the tables it touched, on a throw nothing. */
  write<TResult>(run: (transaction: StoreTransaction) => TResult): TResult;
};

export function createStoreRuntime(adapter: StoreAdapter): StoreRuntime {
  const lifecycle = createStoreLifecycle(adapter);
  const events = createStoreEvents();

  return {
    lifecycle,
    events,
    getDatabase: () => lifecycle.getDatabase(),

    write(run) {
      const touched = new Set<StoreTableName>();
      const result = lifecycle
        .getDatabase()
        .transaction((transaction) =>
          run({ db: transaction, touch: (table) => void touched.add(table) })
        );
      if (touched.size > 0) events.emit(touched);
      return result;
    },
  };
}

let active: StoreRuntime | null = null;

export function installStoreRuntime(adapter: StoreAdapter): StoreRuntime {
  active = createStoreRuntime(adapter);
  return active;
}

export function activeStoreRuntime(): StoreRuntime {
  if (!active) throw new Error("The local store has no runtime installed.");
  return active;
}
