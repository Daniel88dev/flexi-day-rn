import type { ApiFetch, ApiRequestInit } from "@/lib/api";
import { ApiError } from "@/lib/query/failure";
import { createApiRequest } from "@/lib/query/request";

function answering(status: number, body?: unknown) {
  const calls: { path: string; init?: ApiRequestInit }[] = [];
  const apiFetch: ApiFetch = async (path, init) => {
    calls.push({ path, init });
    return {
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
        return body;
      },
    };
  };
  return { request: createApiRequest(apiFetch), calls };
}

describe("createApiRequest", () => {
  it("returns the parsed body of a 2xx answer", async () => {
    const { request } = answering(200, { clockedIn: true });

    await expect(request("/api/attendance/current")).resolves.toEqual({ clockedIn: true });
  });

  it("sends a body as JSON with its content type", async () => {
    const { request, calls } = answering(201, { id: "session-1" });

    await request("/api/attendance/clock-in", { method: "POST", body: { organizationId: "org" } });

    expect(calls[0].init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"organizationId":"org"}',
    });
  });

  it("sends no body and no content type for a read", async () => {
    const { request, calls } = answering(200, []);

    await request("/api/users/me/approvals");

    expect(calls[0].init?.headers).toBeUndefined();
    expect(calls[0].init?.body).toBeUndefined();
  });

  it("returns nothing for a 204", async () => {
    const { request } = answering(204);

    await expect(request("/api/notifications/read-all", { method: "POST" })).resolves.toBe(
      undefined
    );
  });

  it("throws an ApiError carrying the status and the server's message outside 2xx", async () => {
    const { request } = answering(409, { errors: [{ message: "You are already clocked in" }] });

    const error = await request("/api/attendance/clock-in", { method: "POST" }).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, serverMessage: "You are already clocked in" });
  });

  it("carries the first error's context, which names the refusal's reason", async () => {
    const { request } = answering(422, {
      errors: [
        {
          message: "A session can't be longer than 16:00",
          context: { reason: "OVER_CEILING", ceilingMinutes: 960 },
        },
      ],
    });

    const error = await request("/api/attendance/sessions", { method: "POST" }).catch(
      (caught: unknown) => caught
    );

    expect(error).toMatchObject({
      status: 422,
      context: { reason: "OVER_CEILING", ceilingMinutes: 960 },
    });
  });

  it("carries no context when the server sent none", async () => {
    const { request } = answering(500);

    const error = await request("/api/attendance/sessions", { method: "POST" }).catch(
      (caught: unknown) => caught
    );

    expect(error).toMatchObject({ status: 500, serverMessage: null });
    expect((error as ApiError).context).toBeUndefined();
  });

  it("throws what the fetch threw when no answer arrived", async () => {
    const offline = new TypeError("Network request failed");
    const request = createApiRequest(() => Promise.reject(offline));

    await expect(request("/api/attendance/current")).rejects.toBe(offline);
  });
});
