import { rootRoute } from "@/lib/session/root-route";

const CACHED = { userId: "a-user" };

describe("rootRoute", () => {
  it("returns wait until the Device id is read", () => {
    expect(rootRoute({ deviceIdRead: false, cachedSession: undefined })).toBe("wait");
  });

  it("returns wait while the Device id is unread and a session is already cached", () => {
    expect(rootRoute({ deviceIdRead: false, cachedSession: CACHED })).toBe("wait");
  });

  it("returns wait while the session cache is still being read", () => {
    expect(rootRoute({ deviceIdRead: true, cachedSession: undefined })).toBe("wait");
  });

  it("returns signed-in for a cached session", () => {
    expect(rootRoute({ deviceIdRead: true, cachedSession: CACHED })).toBe("signed-in");
  });

  it("returns welcome when nothing is cached", () => {
    expect(rootRoute({ deviceIdRead: true, cachedSession: null })).toBe("welcome");
  });
});
