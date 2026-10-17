import { createPushRegistrar, type PushApi, type PushDevice } from "../client";

const TOKEN = "a1b2c3d4".repeat(8);

function fakes(overrides: Partial<PushDevice> = {}) {
  const api: jest.Mocked<PushApi> = {
    upsert: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const device: jest.Mocked<PushDevice> = {
    token: jest.fn().mockResolvedValue(TOKEN),
    environment: jest.fn().mockResolvedValue("sandbox"),
    unregister: jest.fn().mockResolvedValue(undefined),
    setBadge: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<PushDevice>;
  const client = createPushRegistrar({ api, device });
  client.signedIn();
  return { api, device, client };
}

describe("createPushRegistrar", () => {
  describe("sync", () => {
    it("registers the device token and its environment while permission is granted", async () => {
      const { api, client } = fakes();

      await client.sync("granted");

      expect(api.upsert).toHaveBeenCalledWith({ token: TOKEN, environment: "sandbox" });
    });

    it("registers again on every sync, since a session swap drops the server's row", async () => {
      const { api, client } = fakes();

      await client.sync("granted");
      await client.sync("granted");

      expect(api.upsert).toHaveBeenCalledTimes(2);
    });

    it("deletes the registration when permission turns out revoked", async () => {
      const { api, device, client } = fakes();

      await client.sync("granted");
      await client.sync("denied");

      expect(api.remove).toHaveBeenCalledTimes(1);
      expect(device.token).toHaveBeenCalledTimes(1);
    });

    it("deletes once while permission stays revoked, not on every foreground", async () => {
      const { api, client } = fakes();

      await client.sync("denied");
      await client.sync("denied");

      expect(api.remove).toHaveBeenCalledTimes(1);
    });

    it("deletes again after permission was granted and revoked once more", async () => {
      const { api, client } = fakes();

      await client.sync("denied");
      await client.sync("granted");
      await client.sync("denied");

      expect(api.remove).toHaveBeenCalledTimes(2);
    });

    it.each(["unknown", "undetermined"] as const)(
      "does nothing while permission is %s",
      async (permission) => {
        const { api, device, client } = fakes();

        await client.sync(permission);

        expect(device.token).not.toHaveBeenCalled();
        expect(api.upsert).not.toHaveBeenCalled();
        expect(api.remove).not.toHaveBeenCalled();
      }
    );

    it("does nothing before a signed-in shell is up", async () => {
      const api = { upsert: jest.fn(), remove: jest.fn() };
      const device = {
        token: jest.fn(),
        environment: jest.fn(),
        unregister: jest.fn(),
        setBadge: jest.fn(),
      };
      const client = createPushRegistrar({ api, device });

      await client.sync("granted");
      await client.setBadge(1);

      expect(device.token).not.toHaveBeenCalled();
      expect(device.setBadge).not.toHaveBeenCalled();
    });

    it("settles quietly when the token, the environment or the server fails", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const failing = fakes({ token: jest.fn().mockRejectedValue(new Error("no APNs")) });
      const refused = fakes();
      refused.api.upsert.mockRejectedValue(new Error("offline"));
      refused.api.remove.mockRejectedValue(new Error("offline"));

      await expect(failing.client.sync("granted")).resolves.toBeUndefined();
      await expect(refused.client.sync("granted")).resolves.toBeUndefined();
      await expect(refused.client.sync("denied")).resolves.toBeUndefined();

      expect(failing.api.upsert).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("deletes again on the next sync when the last delete failed", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const { api, client } = fakes();
      api.remove.mockRejectedValueOnce(new Error("offline"));

      await client.sync("denied");
      await client.sync("denied");

      expect(api.remove).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });

    it("joins a sync already running for the same permission", async () => {
      const { api, client } = fakes();

      await Promise.all([client.sync("granted"), client.sync("granted")]);

      expect(api.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("setBadge", () => {
    it("sets the app badge while signed in", async () => {
      const { device, client } = fakes();

      await client.setBadge(3);

      expect(device.setBadge).toHaveBeenCalledWith(3);
    });

    it("leaves the badge the wipe cleared alone when a read answers after it", async () => {
      const { device, client } = fakes();

      const unregistering = client.unregister();
      await client.setBadge(3);
      await unregistering;
      await client.setBadge(2);

      expect(device.setBadge).not.toHaveBeenCalled();
    });
  });

  describe("unregister", () => {
    it("lets the device go of push: APNs, the badge and the delivered notices", async () => {
      const { device, client } = fakes();

      await client.unregister();

      expect(device.unregister).toHaveBeenCalledTimes(1);
    });

    it("never registers a token a sync fetched while the wipe ran", async () => {
      let answer: (token: string) => void = () => {};
      const { api, device, client } = fakes({
        token: jest.fn(() => new Promise<string>((resolve) => (answer = resolve))),
      });

      const syncing = client.sync("granted");
      await Promise.resolve();
      const unregistering = client.unregister();
      answer(TOKEN);
      await Promise.all([syncing, unregistering]);

      expect(api.upsert).not.toHaveBeenCalled();
      expect(device.unregister).toHaveBeenCalledTimes(1);
    });

    it("unregisters from APNs only after a running sync has asked for its token", async () => {
      const order: string[] = [];
      let answer: (token: string) => void = () => {};
      const { client } = fakes({
        token: jest.fn(() => {
          order.push("token");
          return new Promise<string>((resolve) => (answer = resolve));
        }),
        unregister: jest.fn(async () => {
          order.push("unregister");
        }),
      });

      const syncing = client.sync("granted");
      await Promise.resolve();
      const unregistering = client.unregister();
      await Promise.resolve();
      answer(TOKEN);
      await Promise.all([syncing, unregistering]);

      expect(order).toEqual(["token", "unregister"]);
    });

    it("does not wait on a registration request the server has not answered", async () => {
      const { api, device, client } = fakes();
      api.upsert.mockReturnValue(new Promise<void>(() => {}));

      void client.sync("granted");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await client.unregister();

      expect(device.unregister).toHaveBeenCalledTimes(1);
    });

    it("drops a sync still queued behind another when the wipe starts", async () => {
      const { api, device, client } = fakes();

      const first = client.sync("denied");
      const queued = client.sync("granted");
      const unregistering = client.unregister();
      await Promise.all([first, queued, unregistering]);

      expect(device.token).not.toHaveBeenCalled();
      expect(api.upsert).not.toHaveBeenCalled();
    });

    it("drops a sync asked for during the wipe when nobody has signed in since", async () => {
      let release: () => void = () => {};
      const { api, device, client } = fakes({
        unregister: jest.fn(() => new Promise<void>((resolve) => (release = resolve))),
      });

      const unregistering = client.unregister();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const syncing = client.sync("granted");
      release();
      await Promise.all([unregistering, syncing]);

      expect(device.token).not.toHaveBeenCalled();
      expect(api.upsert).not.toHaveBeenCalled();
    });

    it("registers again on the next sign-in", async () => {
      const { api, client } = fakes();

      await client.unregister();
      client.signedIn();
      await client.sync("granted");

      expect(api.upsert).toHaveBeenCalledTimes(1);
    });

    it("registers a sign-in that lands while the wipe still runs, once the wipe is done", async () => {
      const order: string[] = [];
      let release: () => void = () => {};
      const { api, client } = fakes({
        unregister: jest.fn(
          () =>
            new Promise<void>((resolve) => {
              release = () => {
                order.push("unregister");
                resolve();
              };
            })
        ),
      });
      api.upsert.mockImplementation(async () => {
        order.push("upsert");
      });

      const unregistering = client.unregister();
      await new Promise((resolve) => setTimeout(resolve, 0));
      client.signedIn();
      const syncing = client.sync("granted");
      release();
      await Promise.all([unregistering, syncing]);

      expect(order).toEqual(["unregister", "upsert"]);
    });

    it("registers the next user even while the last user's sync is still running", async () => {
      const { api, device, client } = fakes();
      device.environment.mockReturnValueOnce(new Promise(() => {}));

      void client.sync("granted");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await client.unregister();
      client.signedIn();
      await client.sync("granted");

      expect(api.upsert).toHaveBeenCalledTimes(1);
    });

    it("rejects with the device's refusal, for the wipe to log", async () => {
      const { client } = fakes({ unregister: jest.fn().mockRejectedValue(new Error("no APNs")) });

      await expect(client.unregister()).rejects.toThrow("no APNs");
    });
  });
});
