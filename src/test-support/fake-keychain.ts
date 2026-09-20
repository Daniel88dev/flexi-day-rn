/** The Keychain the session writes through, as a map a test can read back. */
export type FakeKeychain = {
  setItemAsync(key: string, value: string): Promise<void>;
  entries(): Record<string, string>;
};

export function createFakeKeychain(seed: Record<string, string> = {}): FakeKeychain {
  const held = new Map(Object.entries(seed));

  return {
    setItemAsync: async (key, value) => {
      held.set(key, value);
    },
    entries: () => Object.fromEntries(held),
  };
}
