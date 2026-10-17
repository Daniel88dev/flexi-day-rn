import { detectPushEnvironment, type ProvisioningApi } from "../environment";

function provisioning(
  aps: "development" | "production" | null | Error,
  simulator: boolean
): ProvisioningApi {
  return {
    apsEnvironment: async () => {
      if (aps instanceof Error) throw aps;
      return aps;
    },
    isSimulator: async () => simulator,
  };
}

describe("detectPushEnvironment", () => {
  it("returns sandbox for a development profile, as an Xcode dev client carries", async () => {
    await expect(detectPushEnvironment(provisioning("development", false))).resolves.toBe(
      "sandbox"
    );
  });

  it("returns production for a production profile, as a TestFlight install carries", async () => {
    await expect(detectPushEnvironment(provisioning("production", false))).resolves.toBe(
      "production"
    );
  });

  it("returns sandbox on the simulator, which has no profile and registers with the sandbox", async () => {
    await expect(detectPushEnvironment(provisioning(null, true))).resolves.toBe("sandbox");
  });

  it("returns production on a device whose profile names no environment", async () => {
    await expect(detectPushEnvironment(provisioning(null, false))).resolves.toBe("production");
  });

  it("returns production on a device whose profile cannot be read", async () => {
    await expect(detectPushEnvironment(provisioning(new Error("no profile"), false))).resolves.toBe(
      "production"
    );
  });

  it("returns sandbox on the simulator even when the profile read fails", async () => {
    await expect(detectPushEnvironment(provisioning(new Error("no profile"), true))).resolves.toBe(
      "sandbox"
    );
  });
});
