import { avatarColor, firstName, initials } from "@/lib/viewer/viewer";

describe("firstName", () => {
  it("returns the first word of the name", () => {
    expect(firstName("Dana Kučerová", "there")).toBe("Dana");
  });

  it("returns the fallback for a missing or blank name", () => {
    expect(firstName(undefined, "there")).toBe("there");
    expect(firstName("   ", "there")).toBe("there");
  });
});

describe("initials", () => {
  it("returns at most two uppercase initials", () => {
    expect(initials("Dana Kučerová")).toBe("DK");
    expect(initials("Dana Marie Kučerová")).toBe("DM");
    expect(initials("dana")).toBe("D");
  });

  it("returns an empty string for a missing name", () => {
    expect(initials(undefined)).toBe("");
  });
});

describe("avatarColor", () => {
  it("returns the colour the backend's user summary gives the same id", () => {
    expect(avatarColor("user-1")).toBe("hsl(225, 65%, 50%)");
    expect(avatarColor("u-daniel")).toBe("hsl(39, 65%, 50%)");
  });
});
