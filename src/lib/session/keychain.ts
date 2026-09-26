import * as SecureStore from "expo-secure-store";

// This-device-only keeps the Device id and the cookie jar out of backups: a phone restored from
// another phone's backup mints its own Device id and signs in again. The class is fixed when an
// entry is first written; later writes to the same key keep it.
export const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** SecureStore with the app's Keychain class on every call; one object, shared by every reader. */
export const keychain = {
  getItem: (key: string) => SecureStore.getItem(key, KEYCHAIN_OPTIONS),
  getItemAsync: (key: string) => SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS),
  setItem: (key: string, value: string) => SecureStore.setItem(key, value, KEYCHAIN_OPTIONS),
  setItemAsync: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS),
};
