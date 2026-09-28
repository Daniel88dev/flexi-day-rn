import type { Dictionary } from "@/i18n";
// The failure module rather than the query index, which Jest cannot load from here.
import { ApiError } from "@/lib/query/failure";

import { formatMinutes } from "./format";

export type EntryFailure =
  | { kind: "network" }
  | { kind: "server" }
  | {
      kind: "refused";
      status: number;
      reason: string | null;
      ceilingMinutes: number | null;
      serverMessage: string | null;
    };

const UNAUTHORIZED = 401;

/** How a failed self-service write reads in its sheet; null for a 401, which the wipe has. */
export function entryFailureOf(failure: unknown): EntryFailure | null {
  if (!(failure instanceof ApiError)) return { kind: "network" };
  if (failure.status === UNAUTHORIZED) return null;
  if (failure.status >= 500) return { kind: "server" };
  const { reason, ceilingMinutes } = failure.context ?? {};
  return {
    kind: "refused",
    status: failure.status,
    reason: typeof reason === "string" ? reason : null,
    ceilingMinutes: typeof ceilingMinutes === "number" ? ceilingMinutes : null,
    serverMessage: failure.serverMessage,
  };
}

/** The web's wording for every reason the attendance writes send, else the server's own. */
export function refusalMessage(
  refusal: Extract<EntryFailure, { kind: "refused" }>,
  t: Dictionary,
  fallback: string = t.entry.failed
): string {
  if (refusal.reason === "OVER_CEILING" && refusal.ceilingMinutes !== null) {
    return t.entry.overCeiling(formatMinutes(refusal.ceilingMinutes));
  }
  const wording: Record<string, string> = t.entry.refusals;
  const known = refusal.reason !== null ? wording[refusal.reason] : undefined;
  return known ?? refusal.serverMessage ?? fallback;
}
