import { addressLines, showSectionPath } from "@/lib/directory";

describe("showSectionPath", () => {
  it("returns the Show route of one Section in the given language", () => {
    expect(showSectionPath("o a", "e/1", "personal", "cs")).toBe(
      "/api/directory/o%20a/people/e%2F1/show/personal?language=cs"
    );
  });
});

describe("addressLines", () => {
  it("returns every filled part, the postal code beside the city", () => {
    expect(
      addressLines({
        line1: "Dlouhá 12",
        line2: "Flat 4",
        postalCode: "110 00",
        city: "Praha",
        region: "Hlavní město Praha",
        country: { code: "CZ", name: "Czechia" },
      })
    ).toEqual(["Dlouhá 12", "Flat 4", "110 00 Praha", "Hlavní město Praha", "Czechia"]);
  });

  it("returns no line for an empty part", () => {
    expect(
      addressLines({
        line1: "1 Main St",
        line2: null,
        postalCode: null,
        city: "Dublin",
        region: null,
        country: { code: "IE", name: "Ireland" },
      })
    ).toEqual(["1 Main St", "Dublin", "Ireland"]);
  });
});
