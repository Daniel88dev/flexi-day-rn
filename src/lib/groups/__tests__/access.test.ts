import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import {
  administeredBadge,
  badgeLabel,
  serverBadge,
  showsOrgAdminNotice,
} from "@/lib/groups/access";

describe("administeredBadge", () => {
  it("returns Org admin for authority through the organization", () => {
    expect(administeredBadge(true)).toBe("orgAdmin");
  });

  it("returns Manager for a group the viewer manages without belonging to it", () => {
    expect(administeredBadge(false)).toBe("manager");
  });
});

describe("serverBadge", () => {
  it("returns Org admin whenever the server says the authority is the organization's", () => {
    expect(serverBadge({ viaOrgAdmin: true, isMember: false })).toBe("orgAdmin");
    expect(serverBadge({ viaOrgAdmin: true, isMember: true })).toBe("orgAdmin");
  });

  it("returns Manager for a non-member the server lets in without the organization", () => {
    expect(serverBadge({ viaOrgAdmin: false, isMember: false })).toBe("manager");
  });

  it("returns nothing for a member the store does not hold yet", () => {
    expect(serverBadge({ viaOrgAdmin: false, isMember: true })).toBeNull();
  });
});

describe("showsOrgAdminNotice", () => {
  it("returns true only for an org admin who is not a member", () => {
    expect(showsOrgAdminNotice({ viaOrgAdmin: true, isMember: false })).toBe(true);
    expect(showsOrgAdminNotice({ viaOrgAdmin: true, isMember: true })).toBe(false);
    expect(showsOrgAdminNotice({ viaOrgAdmin: false, isMember: false })).toBe(false);
    expect(showsOrgAdminNotice({ viaOrgAdmin: false, isMember: true })).toBe(false);
  });
});

describe("badgeLabel", () => {
  it("returns the badge's name in the dictionary's language", () => {
    expect(badgeLabel(en, "orgAdmin")).toBe("Org admin");
    expect(badgeLabel(en, "approver")).toBe("Approver");
    expect(badgeLabel(cs, "orgAdmin")).toBe("Správce organizace");
    expect(badgeLabel(cs, "manager")).toBe("Manažer");
  });
});
