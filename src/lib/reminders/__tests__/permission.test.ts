import { createPermissionSource, type PermissionApi } from "../permission";

function api(initial: "undetermined" | "granted" | "denied", answer = initial) {
  let status = initial;
  const fake: PermissionApi & { set(next: typeof status): void } = {
    get: jest.fn(async () => status),
    request: jest.fn(async () => {
      if (status === "undetermined") status = answer;
      return status;
    }),
    set: (next) => {
      status = next;
    },
  };
  return fake;
}

describe("createPermissionSource", () => {
  it("returns unknown until the first read answers", async () => {
    const source = createPermissionSource(api("denied"));

    expect(source.read()).toBe("unknown");
    await source.refresh();
    expect(source.read()).toBe("denied");
  });

  it("returns the answer to the prompt and tells subscribers", async () => {
    const source = createPermissionSource(api("undetermined", "granted"));
    const listener = jest.fn();
    source.subscribe(listener);
    await source.refresh();

    await expect(source.request()).resolves.toBe("granted");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("returns a change made in iOS Settings on the next refresh", async () => {
    const fake = api("granted");
    const source = createPermissionSource(fake);
    await source.refresh();

    fake.set("denied");
    await source.refresh();

    expect(source.read()).toBe("denied");
  });

  it("keeps the last answer when iOS cannot be read", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const fake = api("granted");
    const source = createPermissionSource(fake);
    await source.refresh();
    (fake.get as jest.Mock).mockRejectedValueOnce(new Error("no"));

    await source.refresh();

    expect(source.read()).toBe("granted");
  });
});
