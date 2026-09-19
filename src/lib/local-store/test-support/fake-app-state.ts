import type { AppStateSource } from "../app-state";

export type FakeAppState = AppStateSource & {
  becomeActive(): void;
  listening(): boolean;
};

export function createFakeAppState(): FakeAppState {
  const listeners = new Set<() => void>();

  return {
    subscribe(onActive) {
      listeners.add(onActive);
      return () => {
        listeners.delete(onActive);
      };
    },

    becomeActive() {
      for (const listener of [...listeners]) listener();
    },

    listening: () => listeners.size > 0,
  };
}
