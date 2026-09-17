import { resolveApiUrl } from "@/lib/api";

describe("resolveApiUrl", () => {
  it("returns the explicit URL without a trailing slash", () => {
    expect(resolveApiUrl("http://192.168.0.33:8080/", "localhost:8081")).toBe(
      "http://192.168.0.33:8080"
    );
  });

  it("returns the Metro host on port 8080 when no URL is set", () => {
    expect(resolveApiUrl(undefined, "192.168.0.33:8081")).toBe("http://192.168.0.33:8080");
  });

  it("returns localhost when neither is known", () => {
    expect(resolveApiUrl(undefined, undefined)).toBe("http://localhost:8080");
    expect(resolveApiUrl("", "")).toBe("http://localhost:8080");
  });
});
