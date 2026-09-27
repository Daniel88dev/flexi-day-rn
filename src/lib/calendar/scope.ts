import type { RequestListScope, RequestScopeGroup } from "@/lib/local-store";
import type { MySettings } from "@/lib/query";

export type DashboardScopeInput = {
  /** Undefined until `/me/settings` answers, and while it cannot. */
  settings: Pick<MySettings, "dashboardScope" | "dashboardGroupId"> | undefined;
  /** Picked on the dashboard this session, each over its stored default. */
  scopeChoice: RequestListScope["kind"] | null;
  groupChoice: string | null;
  /** The groups the viewer sees in full. */
  groups: readonly RequestScopeGroup[];
};

/**
 * The web dashboard's rule, with the scope and the group chosen apart as its `scopeOverride` and
 * `groupOverride` are: each session choice over its stored default, and Group only for a group
 * the viewer sees in full, falling back to the first one. `groupId` is the group Group shows, so
 * Mine and back lands on the group picked before.
 */
export function dashboardScope({
  settings,
  scopeChoice,
  groupChoice,
  groups,
}: DashboardScopeInput): { scope: RequestListScope; groupId: string | null } {
  const preferred = groupChoice ?? settings?.dashboardGroupId ?? null;
  const groupId =
    groups.find((group) => group.groupId === preferred)?.groupId ?? groups[0]?.groupId ?? null;
  const kind = scopeChoice ?? (settings?.dashboardScope === "GROUP" ? "group" : "mine");

  return {
    scope: kind === "group" && groupId ? { kind: "group", groupId } : { kind: "mine" },
    groupId,
  };
}
