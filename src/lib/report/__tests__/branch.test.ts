import { reportBranch } from "../branch";
import type { ReportScope, ReportScopeGroup } from "../types";

function group(groupId: string, access: ReportScopeGroup["access"]): ReportScopeGroup {
  return { groupId, groupName: groupId, access, canEditQuotas: false };
}

function scope(groups: ReportScopeGroup[]): ReportScope {
  return { groups, members: [], years: [2026] };
}

describe("reportBranch", () => {
  it("returns loading while the scope has not answered", () => {
    expect(reportBranch(undefined, false)).toBe("loading");
  });

  it("returns offline when the first scope read failed with nothing kept", () => {
    expect(reportBranch(undefined, true)).toBe("offline");
  });

  it("returns empty for a scope with no groups", () => {
    expect(reportBranch(scope([]), false)).toBe("empty");
  });

  it("returns self when every group is self", () => {
    expect(reportBranch(scope([group("g-1", "self"), group("g-2", "self")]), false)).toBe("self");
  });

  it("returns overview when any group is all", () => {
    expect(reportBranch(scope([group("g-1", "self"), group("g-2", "all")]), false)).toBe(
      "overview"
    );
  });

  it("returns the kept scope's branch when a later read failed", () => {
    expect(reportBranch(scope([group("g-1", "all")]), true)).toBe("overview");
  });
});
