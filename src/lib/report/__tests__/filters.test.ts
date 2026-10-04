import {
  filtersMoved,
  keepVisiblePeople,
  periodChoices,
  pickLabel,
  pickWithGroups,
  togglePick,
  visiblePeople,
} from "../filters";
import { crossScope, ownerScope, scopeMember } from "@/test-support/report";

const nameOf = new Map([
  ["a", "Alpha"],
  ["b", "Beta"],
  ["c", "Gamma"],
]);
const count = (n: number) => `${n} groups`;

describe("pickLabel", () => {
  it("returns the default label when nothing is picked", () => {
    expect(pickLabel([], nameOf, "All groups", count)).toBe("All groups");
  });

  it("returns the one name when one is picked", () => {
    expect(pickLabel(["b"], nameOf, "All groups", count)).toBe("Beta");
  });

  it("returns the count when several are picked", () => {
    expect(pickLabel(["a", "c"], nameOf, "All groups", count)).toBe("2 groups");
  });

  it("returns the count for one pick whose name is unknown", () => {
    expect(pickLabel(["z"], nameOf, "All groups", count)).toBe("1 groups");
  });
});

describe("togglePick", () => {
  const order = ["a", "b", "c"];

  it("returns the pick added, in the options' order", () => {
    expect(togglePick(["c"], "a", order)).toEqual(["a", "c"]);
  });

  it("returns the pick removed", () => {
    expect(togglePick(["a", "c"], "c", order)).toEqual(["a"]);
  });

  it("returns no picks once every option is picked, since that is the default", () => {
    expect(togglePick(["a", "b"], "c", order)).toEqual([]);
  });
});

describe("visiblePeople", () => {
  it("returns everyone in scope by name when no group is picked", () => {
    expect(visiblePeople(ownerScope, []).map((row) => row.member.id)).toEqual([
      "u-alice",
      "u-bob",
      "u-erin",
      "u-frank",
    ]);
  });

  it("returns only the people of the picked groups, with their group as the hint", () => {
    const rows = visiblePeople(crossScope, ["g-team"]);
    expect(rows.map((row) => row.member.id)).toEqual(["u-alice", "u-bob"]);
    expect(rows[0]?.groupNames).toEqual(["Dev Team"]);
  });

  it("returns a person in two picked groups once, naming both groups", () => {
    const scope = {
      ...ownerScope,
      members: [...ownerScope.members, scopeMember({ id: "u-alice", groupId: "g-support" })],
    };
    const rows = visiblePeople(scope, []);
    expect(rows.filter((row) => row.member.id === "u-alice")).toHaveLength(1);
    expect(rows.find((row) => row.member.id === "u-alice")?.groupNames).toEqual([
      "Dev Support",
      "Dev Team",
    ]);
  });
});

describe("keepVisiblePeople", () => {
  it("returns the picked people still in the picked groups", () => {
    expect(keepVisiblePeople(ownerScope, ["g-team"], ["u-alice", "u-erin"])).toEqual(["u-alice"]);
  });

  it("returns every pick when no group is picked", () => {
    expect(keepVisiblePeople(ownerScope, [], ["u-alice", "u-erin"])).toEqual(["u-alice", "u-erin"]);
  });
});

describe("pickWithGroups", () => {
  it("returns the new groups and drops picked people no longer visible", () => {
    expect(
      pickWithGroups(ownerScope, { period: 2026, groupIds: [], userIds: ["u-frank", "u-bob"] }, [
        "g-team",
      ])
    ).toEqual({ period: 2026, groupIds: ["g-team"], userIds: ["u-bob"] });
  });
});

describe("periodChoices", () => {
  const today = new Date(2026, 9, 4);

  it("returns the rolling window, then each year in scope newest first", () => {
    expect(periodChoices([2025, 2026], today)).toEqual(["rolling", 2026, 2025]);
  });

  it("returns the current year when the scope lists none", () => {
    expect(periodChoices([], today)).toEqual(["rolling", 2026]);
  });
});

describe("filtersMoved", () => {
  it("returns false on the defaults", () => {
    expect(filtersMoved({ period: "rolling", groupIds: [], userIds: [] })).toBe(false);
  });

  it("returns true once the period, the groups or the people are off their default", () => {
    expect(filtersMoved({ period: 2025, groupIds: [], userIds: [] })).toBe(true);
    expect(filtersMoved({ period: "rolling", groupIds: ["g-team"], userIds: [] })).toBe(true);
    expect(filtersMoved({ period: "rolling", groupIds: [], userIds: ["u-bob"] })).toBe(true);
  });
});
