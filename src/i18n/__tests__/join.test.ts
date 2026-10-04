import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

describe("join.joined", () => {
  it("returns the group's name when the read found one", () => {
    expect(en.join.joined("Dev Team")).toBe("You joined Dev Team");
    expect(cs.join.joined("Dev Team")).toBe("Připojili jste se ke skupině Dev Team");
  });

  it("returns the group without a name when the read failed", () => {
    expect(en.join.joined(null)).toBe("You joined the group");
    expect(cs.join.joined(null)).toBe("Připojili jste se ke skupině");
  });
});

describe("join.alreadyMember", () => {
  it("returns the group's name, or this group without one", () => {
    expect(en.join.alreadyMember("Dev Team")).toBe("You're already in Dev Team");
    expect(en.join.alreadyMember(null)).toBe("You're already in this group");
    expect(cs.join.alreadyMember("Dev Team")).toBe("Do skupiny Dev Team už patříte");
    expect(cs.join.alreadyMember(null)).toBe("Do této skupiny už patříte");
  });
});

describe("join", () => {
  it("returns a Czech line for every English one", () => {
    const keys = (value: object) => Object.keys(value).sort();
    expect(keys(cs.join)).toEqual(keys(en.join));
    expect(keys(cs.join.sheet)).toEqual(keys(en.join.sheet));
    expect(keys(cs.join.errors)).toEqual(keys(en.join.errors));
    for (const line of [...Object.values(cs.join.sheet), ...Object.values(cs.join.errors)]) {
      expect(line).not.toBe("");
    }
  });
});
