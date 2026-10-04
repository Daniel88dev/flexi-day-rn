import type { ReportScope } from "./types";

export type ReportBranch = "loading" | "offline" | "empty" | "self" | "overview";

/** What Report shows, decided from the loaded scope alone. A kept scope outlives a failed reread. */
export function reportBranch(scope: ReportScope | undefined, failed: boolean): ReportBranch {
  if (!scope) return failed ? "offline" : "loading";
  if (scope.groups.length === 0) return "empty";
  if (scope.groups.every((group) => group.access === "self")) return "self";
  return "overview";
}
