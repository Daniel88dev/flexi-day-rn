import { dashboardScope, type DashboardScopeInput } from "../scope";

const GROUPS = [
  { groupId: "g-design", groupName: "Design" },
  { groupId: "g-platform", groupName: "Platform" },
];

const STORED_GROUP = { dashboardScope: "GROUP", dashboardGroupId: "g-platform" } as const;
const NO_CHOICE = { scopeChoice: null, groupChoice: null, groups: GROUPS };

const scopeOf = (input: DashboardScopeInput) => dashboardScope(input);

describe("dashboardScope", () => {
  it("returns Mine while the settings have not answered", () => {
    expect(scopeOf({ settings: undefined, ...NO_CHOICE })).toEqual({
      scope: { kind: "mine" },
      groupId: "g-design",
    });
  });

  it("returns the stored group when the settings ask for Group", () => {
    expect(scopeOf({ settings: STORED_GROUP, ...NO_CHOICE })).toEqual({
      scope: { kind: "group", groupId: "g-platform" },
      groupId: "g-platform",
    });
  });

  it("returns Mine when the settings ask for Mine, keeping the stored group for the picker", () => {
    const settings = { dashboardScope: "MINE", dashboardGroupId: "g-platform" } as const;

    expect(scopeOf({ settings, ...NO_CHOICE })).toEqual({
      scope: { kind: "mine" },
      groupId: "g-platform",
    });
  });

  it("returns the first group the viewer sees in full when the stored one is not among them", () => {
    const settings = { dashboardScope: "GROUP", dashboardGroupId: "g-gone" } as const;

    expect(scopeOf({ settings, ...NO_CHOICE }).scope).toEqual({
      kind: "group",
      groupId: "g-design",
    });
  });

  it("returns Mine for Group when the viewer sees no group in full", () => {
    expect(scopeOf({ settings: STORED_GROUP, ...NO_CHOICE, groups: [] })).toEqual({
      scope: { kind: "mine" },
      groupId: null,
    });
  });

  it("returns the session's scope over the stored default", () => {
    expect(scopeOf({ settings: STORED_GROUP, ...NO_CHOICE, scopeChoice: "mine" }).scope).toEqual({
      kind: "mine",
    });
    expect(scopeOf({ settings: undefined, ...NO_CHOICE, scopeChoice: "group" }).scope).toEqual({
      kind: "group",
      groupId: "g-design",
    });
  });

  it("returns the session's group over the stored one", () => {
    expect(
      scopeOf({ settings: STORED_GROUP, ...NO_CHOICE, groupChoice: "g-design" }).scope
    ).toEqual({ kind: "group", groupId: "g-design" });
  });

  it("returns the session's group again after Mine and back to Group", () => {
    const picked = { settings: STORED_GROUP, ...NO_CHOICE, groupChoice: "g-design" };

    expect(scopeOf({ ...picked, scopeChoice: "mine" })).toEqual({
      scope: { kind: "mine" },
      groupId: "g-design",
    });
    expect(scopeOf({ ...picked, scopeChoice: "group" }).scope).toEqual({
      kind: "group",
      groupId: "g-design",
    });
  });
});
