import { reportFiltersToQuery } from "@/lib/query/report-filters";

describe("reportFiltersToQuery", () => {
  it("returns the year alone when nothing is picked", () => {
    expect(reportFiltersToQuery({ year: 2026 })).toBe("year=2026");
    expect(reportFiltersToQuery({ year: 2026, groupIds: [], userIds: [] })).toBe("year=2026");
  });

  it("returns the picked groups and people as comma lists, in the web's order", () => {
    expect(reportFiltersToQuery({ year: 2025, userIds: ["u-1"], groupIds: ["g-1", "g-2"] })).toBe(
      "year=2025&groupIds=g-1%2Cg-2&userIds=u-1"
    );
  });
});
