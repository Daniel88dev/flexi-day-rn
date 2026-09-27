import { focusManager, onlineManager, QueryObserver } from "@tanstack/react-query";

import { ApiError } from "@/lib/query/failure";
import { createQueryClient, shouldRetryQuery } from "@/lib/query/query-client";

describe("shouldRetryQuery", () => {
  it.each([400, 403, 404, 409, 429])("returns false for a %i", (status) => {
    expect(shouldRetryQuery(0, new ApiError(status, null))).toBe(false);
  });

  it("returns true once for a request that got no answer", () => {
    const offline = new TypeError("Network request failed");
    expect(shouldRetryQuery(0, offline)).toBe(true);
    expect(shouldRetryQuery(1, offline)).toBe(false);
  });

  it("returns true once for a 5xx", () => {
    expect(shouldRetryQuery(0, new ApiError(503, null))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError(503, null))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("returns a client whose writes fail at once offline rather than wait for the network", () => {
    const { mutations } = createQueryClient().getDefaultOptions();
    expect(mutations).toMatchObject({ retry: false, networkMode: "always" });
  });
});

describe("createQueryClient, reading", () => {
  const client = createQueryClient();

  beforeAll(() => client.mount());

  afterEach(() => {
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
    client.clear();
  });

  afterAll(() => client.unmount());

  function observe(queryFn: jest.Mock) {
    const observer = new QueryObserver(client, {
      queryKey: ["attendance-state", "own"],
      queryFn,
      retry: false,
      gcTime: Infinity,
    });
    return observer.subscribe(() => undefined);
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("fails a read at once while offline instead of pausing it, so the screen can offer Retry", async () => {
    onlineManager.setOnline(false);
    const queryFn = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

    await expect(
      client.fetchQuery({ queryKey: ["my-settings"], queryFn, retry: false })
    ).rejects.toThrow("Network request failed");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("reads again when the network comes back", async () => {
    onlineManager.setOnline(false);
    const queryFn = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const unsubscribe = observe(queryFn);
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(1);

    queryFn.mockResolvedValue({ clockedIn: false });
    onlineManager.setOnline(true);
    await settle();

    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("reads again on every foreground, even an answer seconds old", async () => {
    const queryFn = jest.fn().mockResolvedValue({ clockedIn: false });
    const unsubscribe = observe(queryFn);
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(1);

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await settle();

    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
