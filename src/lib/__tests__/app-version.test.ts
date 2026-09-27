import { appVersionLabel } from "@/lib/app-version";

describe("appVersionLabel", () => {
  it("returns the version with the build in brackets", () => {
    expect(appVersionLabel("1.4.0", "37")).toBe("1.4.0 (37)");
  });

  it("returns the version alone when the build is unknown", () => {
    expect(appVersionLabel("1.4.0", null)).toBe("1.4.0");
  });

  it("returns null when the version is unknown", () => {
    expect(appVersionLabel(null, "37")).toBeNull();
  });
});
