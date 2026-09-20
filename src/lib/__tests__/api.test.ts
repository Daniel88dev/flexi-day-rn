import { createApiFetch, resolveApiUrl, resolveWebUrl, type ApiRequestConfig } from "@/lib/api";

describe("resolveApiUrl", () => {
  it("returns the explicit URL without a trailing slash", () => {
    expect(resolveApiUrl("http://192.168.0.33:8080/", "localhost:8081")).toBe(
      "http://192.168.0.33:8080"
    );
  });

  it("returns the Metro host on port 8080 when no URL is set", () => {
    expect(resolveApiUrl(undefined, "192.168.0.33:8081")).toBe("http://192.168.0.33:8080");
  });

  it("returns localhost when neither is known", () => {
    expect(resolveApiUrl(undefined, undefined)).toBe("http://localhost:8080");
    expect(resolveApiUrl("", "")).toBe("http://localhost:8080");
  });
});

describe("resolveWebUrl", () => {
  it("returns the explicit URL without a trailing slash", () => {
    expect(resolveWebUrl("http://192.168.0.33:3000/")).toBe("http://192.168.0.33:3000");
  });

  it("returns the production site when no URL is set", () => {
    expect(resolveWebUrl(undefined)).toBe("https://flexi-day.com");
    expect(resolveWebUrl("")).toBe("https://flexi-day.com");
  });
});

const CLIENT_HEADERS = {
  "x-client-device-id": "a-device",
  "x-client-session-id": "a-launch",
  "x-client-platform": "ios",
  "x-client-app-version": "1.4.0+12",
};

function harness(
  options: { status?: number; cookie?: string; clientHeaders?: Record<string, string> } = {}
) {
  const calls: { url: string; config: ApiRequestConfig }[] = [];
  const onUnauthorized = jest.fn();

  const apiFetch = createApiFetch({
    baseUrl: "http://192.168.0.33:8080",
    clientHeaders: () => options.clientHeaders ?? CLIENT_HEADERS,
    cookie: async () => options.cookie ?? "flexi-day.session_token=abc",
    onUnauthorized,
    fetchImpl: async (url, config) => {
      calls.push({ url, config });
      return { status: options.status ?? 200, json: async () => ({}) };
    },
  });

  return { apiFetch, calls, onUnauthorized, lastCall: () => calls[calls.length - 1] };
}

describe("createApiFetch", () => {
  it("returns a response for the path appended to the base URL", async () => {
    const { apiFetch, lastCall } = harness();

    const response = await apiFetch("/api/sync/pull?cursor=7");

    expect(response.status).toBe(200);
    expect(lastCall().url).toBe("http://192.168.0.33:8080/api/sync/pull?cursor=7");
  });

  it("sends the four client headers and the cookie on every request", async () => {
    const { apiFetch, calls } = harness();

    await apiFetch("/api/sync/pull");
    await apiFetch("/api/vacations", { method: "POST", body: "{}" });

    for (const call of calls) {
      expect(call.config.headers).toMatchObject({
        ...CLIENT_HEADERS,
        Cookie: "flexi-day.session_token=abc",
      });
    }
  });

  it("sends no cookie header while the cookie jar is empty", async () => {
    const { apiFetch, lastCall } = harness({ cookie: "" });

    await apiFetch("/api/sync/pull");

    expect(lastCall().config.headers).not.toHaveProperty("Cookie");
  });

  it("sends the caller's own headers beside the client headers", async () => {
    const { apiFetch, lastCall } = harness();

    await apiFetch("/api/vacations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"id":1}',
    });

    expect(lastCall().config.headers).toMatchObject({
      "content-type": "application/json",
      ...CLIENT_HEADERS,
    });
  });

  it("sends no client header the Device id has not been read for", async () => {
    const { apiFetch, lastCall } = harness({ clientHeaders: {} });

    await apiFetch("/api/sync/pull");

    expect(lastCall().config.headers).not.toHaveProperty("x-client-device-id");
  });

  it("sends the method, the body and the abort signal it was given", async () => {
    const { apiFetch, lastCall } = harness();
    const signal = new AbortController().signal;

    await apiFetch("/api/vacations", { method: "PATCH", body: '{"id":1}', signal });

    expect(lastCall().config).toMatchObject({ method: "PATCH", body: '{"id":1}', signal });
  });

  it("omits credentials, so the session travels only in the cookie the auth client holds", async () => {
    const { apiFetch, lastCall } = harness();

    await apiFetch("/api/sync/pull");

    expect(lastCall().config.credentials).toBe("omit");
  });

  it("calls the unauthorized callback on a 401", async () => {
    const { apiFetch, onUnauthorized } = harness({ status: 401 });

    await apiFetch("/api/sync/pull");

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("calls the unauthorized callback on no other status", async () => {
    for (const status of [200, 204, 400, 403, 404, 500]) {
      const { apiFetch, onUnauthorized } = harness({ status });

      await apiFetch("/api/sync/pull");

      expect(onUnauthorized).not.toHaveBeenCalled();
    }
  });

  it("returns the 401 response to its caller after handing it over", async () => {
    const { apiFetch } = harness({ status: 401 });

    await expect(apiFetch("/api/sync/pull")).resolves.toMatchObject({ status: 401 });
  });
});
