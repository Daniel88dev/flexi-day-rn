import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { ApiError } from "@/lib/query/failure";

import { entryFailureOf, refusalMessage } from "../refusals";

// Every `context.reason` the backend's attendance routes send, as their `@openapi` blocks and
// `flexi-day-be/src/services/attendance` name them. A code added here fails until it is worded.
const BACKEND_REASONS = [
  "NOT_YOUR_SESSION",
  "OWN_EMPLOYMENT_ONLY",
  "NO_OPEN_SESSION",
  "NO_OPEN_BREAK",
  "END_BEFORE_START",
  "BREAK_OUTSIDE_SESSION",
  "BREAK_OVERLAPS",
  "SESSION_STILL_OPEN",
  "SELF_SERVICE_WINDOW",
  "SESSION_ALREADY_OPEN",
  "SESSION_OVERLAPS",
  "BREAK_ALREADY_OPEN",
  "SELF_SERVICE_OFF",
  "SELF_SERVICE_DELETE",
  "EMPLOYMENT_ENDED",
  "SELF_SERVICE_DELETE_ENTERED",
  "START_OFF_DATE",
  "OUTSIDE_EMPLOYMENT",
  "END_IN_FUTURE",
  "OVER_CEILING",
  "PLAN_LIMIT",
  "ADMIN_ONLY",
  "SESSION_NOT_CHANGED",
];

const SERVER_TEXT = "The server's own words";

const refused = (reason: string, extra: Record<string, unknown> = {}) =>
  entryFailureOf(new ApiError(409, SERVER_TEXT, { reason, ...extra }));

describe("refusalMessage", () => {
  it("words exactly the backend's reasons, OVER_CEILING by its limit", () => {
    const worded = [...Object.keys(en.entry.refusals), "OVER_CEILING"].sort();

    expect(worded).toEqual([...BACKEND_REASONS].sort());
    expect(Object.keys(cs.entry.refusals).sort()).toEqual(Object.keys(en.entry.refusals).sort());
  });

  it.each(BACKEND_REASONS)(
    "words %s in English and in Czech, not in the server's words",
    (reason) => {
      const failure = refused(reason, { ceilingMinutes: 600 });
      if (failure?.kind !== "refused") throw new Error("expected a refusal");

      const english = refusalMessage(failure, en);
      const czech = refusalMessage(failure, cs);

      expect(english).not.toBe(SERVER_TEXT);
      expect(czech).not.toBe(SERVER_TEXT);
      expect(czech).not.toBe(english);
    }
  );

  it("fills the organization's session limit into OVER_CEILING", () => {
    const failure = refused("OVER_CEILING", { ceilingMinutes: 960 });
    if (failure?.kind !== "refused") throw new Error("expected a refusal");

    expect(refusalMessage(failure, en)).toBe(
      "Can't be longer than 16:00, your organization's session limit."
    );
    expect(refusalMessage(failure, cs)).toBe(
      "Nesmí být delší než 16:00, limit směny ve tvé organizaci."
    );
  });

  it("falls back to the server's message for a reason it does not know", () => {
    const failure = refused("SOMETHING_NEW");
    if (failure?.kind !== "refused") throw new Error("expected a refusal");

    expect(refusalMessage(failure, en)).toBe(SERVER_TEXT);
  });

  it("falls back to its own words when the server sent none", () => {
    const failure = entryFailureOf(new ApiError(422, null));
    if (failure?.kind !== "refused") throw new Error("expected a refusal");

    expect(refusalMessage(failure, en)).toBe("Could not add the session.");
  });
});

describe("entryFailureOf", () => {
  it("returns network for a request that got no answer", () => {
    expect(entryFailureOf(new TypeError("Network request failed"))).toEqual({ kind: "network" });
  });

  it("returns server for a 5xx", () => {
    expect(entryFailureOf(new ApiError(503, "Down"))).toEqual({ kind: "server" });
  });

  it("returns a refusal for a 4xx, carrying its reason and status", () => {
    expect(entryFailureOf(new ApiError(403, "No", { reason: "SELF_SERVICE_WINDOW" }))).toEqual({
      kind: "refused",
      status: 403,
      reason: "SELF_SERVICE_WINDOW",
      ceilingMinutes: null,
      serverMessage: "No",
    });
  });

  it("returns nothing for a 401, which the signed-out wipe already has", () => {
    expect(entryFailureOf(new ApiError(401, null))).toBeNull();
  });
});
