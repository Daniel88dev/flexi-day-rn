import { randomUUID } from "expo-crypto";

import { keychain } from "./keychain";

export const DEVICE_ID_KEY = "flexi-day_device_id";

export type DeviceIdStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
};

/**
 * The id the backend binds a native session to: minted once and kept, so it survives sign-out,
 * the signed-out wipe and a reinstall.
 */
export async function readOrMintDeviceId(
  storage: DeviceIdStorage,
  mintId: () => string
): Promise<string> {
  const stored = await storage.getItemAsync(DEVICE_ID_KEY);
  if (stored) return stored;

  const minted = mintId();
  await storage.setItemAsync(DEVICE_ID_KEY, minted);
  return minted;
}

let deviceId: string | null = null;
let loading: Promise<string> | null = null;

export function loadDeviceId(): Promise<string> {
  if (deviceId) return Promise.resolve(deviceId);

  loading ??= readOrMintDeviceId(keychain, randomUUID).then(
    (id) => {
      deviceId = id;
      loading = null;
      return id;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    }
  );
  return loading;
}

export function currentDeviceId(): string | null {
  return deviceId;
}
