import { ApiError, classifyFailure } from "@/lib/query/failure";

describe("classifyFailure", () => {
  it.each([402, 403, 409])("returns a refusal with the server's message for a %i", (status) => {
    expect(classifyFailure(new ApiError(status, "You no longer approve in this group"))).toEqual({
      kind: "refusal",
      message: "You no longer approve in this group",
    });
  });

  it("returns a refusal without a message when the server gave none", () => {
    expect(classifyFailure(new ApiError(409, null))).toEqual({ kind: "refusal", message: null });
  });

  it("returns a retryable failure without a message when the request never got an answer", () => {
    expect(classifyFailure(new TypeError("Network request failed"))).toEqual({
      kind: "retryable",
      message: null,
    });
  });

  it.each([400, 404, 422])(
    "returns a failure without Retry carrying the server's message for a %i",
    (status) => {
      expect(classifyFailure(new ApiError(status, "Selected day is not a working day"))).toEqual({
        kind: "failed",
        message: "Selected day is not a working day",
      });
    }
  );

  it.each([500, 503])(
    "returns a retryable failure carrying the server's message for a %i",
    (status) => {
      expect(classifyFailure(new ApiError(status, "Failed to clock in"))).toEqual({
        kind: "retryable",
        message: "Failed to clock in",
      });
    }
  );

  it("returns a failure without Retry for a Local store write the server refused with a 422", () => {
    expect(
      classifyFailure({ ok: false, reason: "rejected", status: 422, message: "Too many days" })
    ).toEqual({ kind: "failed", message: "Too many days" });
  });

  it("returns signed-out for a 401, which the signed-out wipe answers", () => {
    expect(classifyFailure(new ApiError(401, "Unauthorized"))).toEqual({ kind: "signed-out" });
  });

  it("returns a refusal for a Local store write the server refused with a 403", () => {
    expect(
      classifyFailure({ ok: false, reason: "rejected", status: 403, message: "Not your request" })
    ).toEqual({ kind: "refusal", message: "Not your request" });
  });

  it("returns a retryable failure for a Local store write that reached no server", () => {
    expect(classifyFailure({ ok: false, reason: "unreachable", message: null })).toEqual({
      kind: "retryable",
      message: null,
    });
  });
});
