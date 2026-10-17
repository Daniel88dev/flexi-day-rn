import { createPushClient, type PushApi, type PushDevice } from "../client";

const TOKEN = "a1b2c3d4".repeat(8);

function fakes(overrides: Partial<PushDevice> = {}) {
  const api: jest.Mocked<PushApi> = {
    register: jest.fn().mockResolvedValue(undefined),
    unregister: jest.fn().mockResolvedValue(undefined),
  };
  const device: jest.Mocked<PushDevice> = {
    token: jest.fn().mockResolvedValue(TOKEN),
    environment: jest.fn().mockResolvedValue("sandbox"),
    letGo: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<PushDevice>;
  return { api, device, client: createPushClient({ api, device }) };
}

describe("createPushClient", () => {
  describe("sync", () => {
    it("registers the device token and its environment while permission is granted", async () => {
      const { api, client } = fakes();

      await client.sync("granted");

      expect(api.register).toHaveBeenCalledWith({ token: TOKEN, environment: "sandbox" });
    });

    it("registers again on every sync, since a session swap drops the server's row", async () => {
      const { api, client } = fakes();

      await client.sync("granted");
      await client.sync("granted");

      expect(api.register).toHaveBeenCalledTimes(2);
    });

    it("deletes the registration when permission turns out revoked", async () => {
      const { api, device, client } = fakes();

      await client.sync("granted");
      await client.sync("denied");

      expect(api.unregister).toHaveBeenCalledTimes(1);
      expect(device.token).toHaveBeenCalledTimes(1);
    });

    it("deletes once while permission stays revoked, not on every foreground", async () => {
      const { api, client } = fakes();

      await client.sync("denied");
      await client.sync("denied");

      expect(api.unregister).toHaveBeenCalledTimes(1);
    });

    it("deletes again after permission was granted and revoked once more", async () => {
      const { api, client } = fakes();

      await client.sync("denied");
      await client.sync("granted");
      await client.sync("denied");

      expect(api.unregister).toHaveBeenCalledTimes(2);
    });

    it.each(["unknown", "undetermined"] as const)(
      "does nothing while permission is %s",
      async (permission) => {
        const { api, device, client } = fakes();

        await client.sync(permission);

        expect(device.token).not.toHaveBeenCalled();
        expect(api.register).not.toHaveBeenCalled();
        expect(api.unregister).not.toHaveBeenCalled();
      }
    );

    it("settles quietly when the token, the environment or the server fails", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const failing = fakes({ token: jest.fn().mockRejectedValue(new Error("no APNs")) });
      const refused = fakes();
      refused.api.register.mockRejectedValue(new Error("offline"));
      refused.api.unregister.mockRejectedValue(new Error("offline"));

      await expect(failing.client.sync("granted")).resolves.toBeUndefined();
      await expect(refused.client.sync("granted")).resolves.toBeUndefined();
      await expect(refused.client.sync("denied")).resolves.toBeUndefined();

      expect(failing.api.register).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("deletes again on the next sync when the last delete failed", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const { api, client } = fakes();
      api.unregister.mockRejectedValueOnce(new Error("offline"));

      await client.sync("denied");
      await client.sync("denied");

      expect(api.unregister).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });

    it("joins a sync already running for the same permission", async () => {
      const { api, client } = fakes();

      await Promise.all([client.sync("granted"), client.sync("granted")]);

      expect(api.register).toHaveBeenCalledTimes(1);
    });
  });

  describe("letGo", () => {
    it("lets the device go of push: APNs, the badge and the delivered notices", async () => {
      const { device, client } = fakes();

      await client.letGo();

      expect(device.letGo).toHaveBeenCalledTimes(1);
    });

    it("never registers a token a sync fetched while the wipe ran", async () => {
      let answer: (token: string) => void = () => {};
      const { api, device, client } = fakes({
        token: jest.fn(() => new Promise<string>((resolve) => (answer = resolve))),
      });

      const syncing = client.sync("granted");
      await Promise.resolve();
      const lettingGo = client.letGo();
      answer(TOKEN);
      await Promise.all([syncing, lettingGo]);

      expect(api.register).not.toHaveBeenCalled();
      expect(device.letGo).toHaveBeenCalledTimes(1);
    });

    it("unregisters from APNs only after a running sync has asked for its token", async () => {
      const order: string[] = [];
      let answer: (token: string) => void = () => {};
      const { client } = fakes({
        token: jest.fn(() => {
          order.push("token");
          return new Promise<string>((resolve) => (answer = resolve));
        }),
        letGo: jest.fn(async () => {
          order.push("letGo");
        }),
      });

      const syncing = client.sync("granted");
      await Promise.resolve();
      const lettingGo = client.letGo();
      await Promise.resolve();
      answer(TOKEN);
      await Promise.all([syncing, lettingGo]);

      expect(order).toEqual(["token", "letGo"]);
    });

    it("does not wait on a registration request the server has not answered", async () => {
      const { api, device, client } = fakes();
      api.register.mockReturnValue(new Promise<void>(() => {}));

      void client.sync("granted");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await client.letGo();

      expect(device.letGo).toHaveBeenCalledTimes(1);
    });

    it("drops a sync still queued behind another when the wipe starts", async () => {
      const { api, device, client } = fakes();

      const first = client.sync("denied");
      const queued = client.sync("granted");
      const lettingGo = client.letGo();
      await Promise.all([first, queued, lettingGo]);

      expect(device.token).not.toHaveBeenCalled();
      expect(api.register).not.toHaveBeenCalled();
    });

    it("ignores a sync asked for while the wipe runs", async () => {
      let release: () => void = () => {};
      const { api, device, client } = fakes({
        letGo: jest.fn(() => new Promise<void>((resolve) => (release = resolve))),
      });

      const lettingGo = client.letGo();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const syncing = client.sync("granted");
      release();
      await Promise.all([lettingGo, syncing]);

      expect(device.token).not.toHaveBeenCalled();
      expect(api.register).not.toHaveBeenCalled();
    });

    it("registers again on the next sign-in", async () => {
      const { api, client } = fakes();

      await client.letGo();
      await client.sync("granted");

      expect(api.register).toHaveBeenCalledTimes(1);
    });

    it("rejects with the device's refusal, for the wipe to log", async () => {
      const { client } = fakes({ letGo: jest.fn().mockRejectedValue(new Error("no APNs")) });

      await expect(client.letGo()).rejects.toThrow("no APNs");
    });
  });
});
