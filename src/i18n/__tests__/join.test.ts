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
    expect(keys(cs.join.screen)).toEqual(keys(en.join.screen));
    expect(keys(cs.join.screen.dead)).toEqual(keys(en.join.screen.dead));
    for (const line of [
      ...Object.values(cs.join.sheet),
      ...Object.values(cs.join.errors),
      ...Object.values(cs.join.screen.dead),
    ]) {
      expect(line).not.toBe("");
    }
  });
});

describe("join.screen.invitedBy", () => {
  it("returns the inviter's line, or the plain invitation without one", () => {
    expect(en.join.screen.invitedBy("Olivia Owner")).toBe("Olivia Owner invited you to join");
    expect(en.join.screen.invitedBy(null)).toBe("You're invited to join");
    expect(cs.join.screen.invitedBy("Olivia Owner")).toBe("Olivia Owner vás zve do skupiny");
    expect(cs.join.screen.invitedBy(null)).toBe("Máte pozvánku do skupiny");
  });
});

describe("join.screen.askForNew", () => {
  it("returns who to ask for a new invite to the group", () => {
    expect(en.join.screen.askForNew("Olivia Owner", "Dev Team")).toBe(
      "Ask Olivia Owner to send you a new one for Dev Team."
    );
    expect(en.join.screen.askForNew(null, "Dev Team")).toBe(
      "Ask the group's manager to send you a new one for Dev Team."
    );
    expect(cs.join.screen.askForNew("Olivia Owner", "Dev Team")).toBe(
      "Novou pozvánku do skupiny Dev Team vám může poslat Olivia Owner."
    );
    expect(cs.join.screen.askForNew(null, "Dev Team")).toBe(
      "Novou pozvánku do skupiny Dev Team vám může poslat manažer skupiny."
    );
  });
});

describe("join.screen.join", () => {
  it("returns the Join button and the already-member line with the group's name", () => {
    expect(en.join.screen.join("Dev Support")).toBe("Join Dev Support");
    expect(cs.join.screen.join("Dev Support")).toBe("Připojit se ke skupině Dev Support");
    expect(en.join.screen.alreadyMember("Dev Support")).toBe("You're already in Dev Support.");
    expect(cs.join.screen.alreadyMember("Dev Support")).toBe("Do skupiny Dev Support už patříte.");
  });
});
