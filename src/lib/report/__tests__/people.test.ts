import { peopleSections } from "../people";
import {
  ownerOverview,
  reportOverview,
  scopeGroup,
  scopeMember,
  summaryRow,
} from "@/test-support/report";

describe("peopleSections", () => {
  it("returns one section per group in the answer's order, people with most left first", () => {
    const sections = peopleSections(ownerOverview, "VACATION");

    expect(sections.map((section) => section.group.groupName)).toEqual(["Dev Support", "Dev Team"]);
    expect(sections[0].rows.map((row) => row.member.name)).toEqual(["Frank Benes", "Erin Kral"]);
    expect(sections[1].rows.map((row) => [row.member.name, row.remaining])).toEqual([
      ["Alice Novak", 15],
      ["Bob Dvorak", -1.5],
    ]);
  });

  it("returns a person in two groups with each group's own figures", () => {
    const overview = reportOverview({
      groups: [scopeGroup({ groupId: "g-1" }), scopeGroup({ groupId: "g-2" })],
      members: [scopeMember({ groupId: "g-1" }), scopeMember({ groupId: "g-2" })],
      summary: [
        summaryRow({ groupId: "g-1", yearQuota: 20, usedToDate: 5 }),
        summaryRow({ groupId: "g-2", yearQuota: 10, usedToDate: 1 }),
      ],
    });

    expect(
      peopleSections(overview, "VACATION").map((section) => section.rows[0].remaining)
    ).toEqual([15, 9]);
  });

  it("returns no section for a group with nobody in it", () => {
    const overview = reportOverview({
      groups: [scopeGroup({ groupId: "g-1" }), scopeGroup({ groupId: "g-empty" })],
      members: [scopeMember({ groupId: "g-1" })],
    });

    expect(peopleSections(overview, "VACATION").map((section) => section.group.groupId)).toEqual([
      "g-1",
    ]);
  });
});
