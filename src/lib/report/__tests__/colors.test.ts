import { CHART_FALLBACK_COLORS, assignMemberColors } from "../colors";
import type { ReportScopeMember } from "../types";

function member(id: string, name: string, avatarColor: string, groupId = "g-1"): ReportScopeMember {
  return { id, name, initials: name.slice(0, 2), avatarColor, groupId };
}

describe("assignMemberColors", () => {
  it("returns each member's avatar colour when no two are alike", () => {
    expect(
      assignMemberColors([
        member("u-1", "Alice", "hsl(0, 70%, 50%)"),
        member("u-2", "Bob", "hsl(120, 70%, 50%)"),
        member("u-3", "Carol", "#2a78d6"),
      ])
    ).toEqual({ "u-1": "hsl(0, 70%, 50%)", "u-2": "hsl(120, 70%, 50%)", "u-3": "#2a78d6" });
  });

  it("returns a fallback colour for the later name when two avatars are too close", () => {
    const colors = assignMemberColors([
      member("u-2", "Bob", "hsl(10, 70%, 50%)"),
      member("u-1", "Alice", "hsl(0, 70%, 50%)"),
    ]);

    expect(colors["u-1"]).toBe("hsl(0, 70%, 50%)");
    expect(CHART_FALLBACK_COLORS).toContain(colors["u-2"]);
  });

  it("returns a fallback colour for an avatar colour it cannot read", () => {
    const colors = assignMemberColors([member("u-1", "Alice", "violet")]);

    expect(CHART_FALLBACK_COLORS).toContain(colors["u-1"]);
  });

  it("returns one colour per person when they appear in several groups", () => {
    const colors = assignMemberColors([
      member("u-1", "Alice", "hsl(0, 70%, 50%)", "g-1"),
      member("u-1", "Alice", "hsl(0, 70%, 50%)", "g-2"),
    ]);

    expect(Object.keys(colors)).toEqual(["u-1"]);
  });

  it("returns the same colours for the same scope whatever order the rows come in", () => {
    const scope = [
      member("u-1", "Alice", "hsl(0, 70%, 50%)"),
      member("u-2", "Bob", "hsl(5, 70%, 50%)"),
      member("u-3", "Carol", "hsl(8, 70%, 52%)"),
      member("u-4", "Dave", "hsl(240, 60%, 45%)"),
    ];

    expect(assignMemberColors([...scope].reverse())).toEqual(assignMemberColors(scope));
  });

  it("returns the same colours for two people with one name whatever order they come in", () => {
    const scope = [
      member("u-2", "Jan Novak", "hsl(0, 70%, 50%)"),
      member("u-1", "Jan Novak", "hsl(4, 70%, 50%)"),
    ];

    const colors = assignMemberColors(scope);
    expect(colors["u-1"]).toBe("hsl(4, 70%, 50%)");
    expect(assignMemberColors([...scope].reverse())).toEqual(colors);
  });
});
