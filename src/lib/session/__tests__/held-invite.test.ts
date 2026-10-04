import { clearHeldInvite, heldInvite, holdInvite, takeHeldInvite } from "@/lib/session/held-invite";

const ALICE = { token: "dev-alice-support-00000000000000000", invitedEmail: "alice@dev.local" };
const NINA = { token: "dev-nina-team-0000000000000000000000", invitedEmail: "nina@dev.local" };

afterEach(() => clearHeldInvite());

describe("holdInvite", () => {
  it("returns nothing until an invite is held", () => {
    expect(heldInvite()).toBeNull();
    expect(takeHeldInvite()).toBeNull();
  });

  it("returns the latest invite held, replacing an earlier one", () => {
    holdInvite(ALICE);
    holdInvite(NINA);

    expect(takeHeldInvite()).toEqual(NINA);
  });
});

describe("heldInvite", () => {
  it("returns the held invite without letting go of it", () => {
    holdInvite(ALICE);

    expect(heldInvite()).toEqual(ALICE);
    expect(heldInvite()).toEqual(ALICE);
    expect(takeHeldInvite()).toEqual(ALICE);
  });
});

describe("takeHeldInvite", () => {
  it("returns the invite once, then nothing", () => {
    holdInvite(ALICE);

    expect(takeHeldInvite()).toEqual(ALICE);
    expect(takeHeldInvite()).toBeNull();
    expect(heldInvite()).toBeNull();
  });
});

describe("clearHeldInvite", () => {
  it("returns nothing after the held invite is cleared", () => {
    holdInvite(ALICE);

    clearHeldInvite();

    expect(takeHeldInvite()).toBeNull();
  });
});
