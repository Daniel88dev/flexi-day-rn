export type PushEnvironment = "sandbox" | "production";

export type ProvisioningApi = {
  /** `aps-environment` from the embedded provisioning profile; `null` when it names none. */
  apsEnvironment(): Promise<"development" | "production" | null>;
  isSimulator(): Promise<boolean>;
};

/**
 * The APNs environment this install's token was issued for, read from the same profile that
 * decided it. `__DEV__` would be wrong for a Release-configuration dev client, which is still
 * sandbox. Anything unreadable on a device is production, the rule Expo's own push token uses.
 */
export async function detectPushEnvironment(api: ProvisioningApi): Promise<PushEnvironment> {
  const aps = await api.apsEnvironment().catch(() => null);
  if (aps === "development") return "sandbox";
  if (aps === "production") return "production";
  return (await api.isSimulator().catch(() => false)) ? "sandbox" : "production";
}
