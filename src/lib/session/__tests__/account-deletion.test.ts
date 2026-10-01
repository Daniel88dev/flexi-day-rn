import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { ApiError } from "@/lib/query/failure";

import {
  blockerKey,
  blockerText,
  deletionFailureOf,
  deletionView,
  statusAfterRefusal,
  type DeletionBlocker,
  type DeletionStatus,
} from "../account-deletion";

const GROUP: DeletionBlocker = {
  kind: "GROUP_HAS_MEMBERS",
  groupId: "6f1c0a52-1b7e-4c38-9a0e-2d5f8c3b4a71",
  groupName: "Design",
  otherMembers: 3,
};
const ORGANIZATION: DeletionBlocker = {
  kind: "ORGANIZATION_HAS_MEMBERS",
  organizationId: "0b8e7d14-5c2a-4f6b-8e3d-9a1c2b3d4e5f",
  organizationName: "Northwind",
  otherMembers: 1,
};
const SUBSCRIPTION: DeletionBlocker = {
  kind: "SUBSCRIPTION_RENEWING",
  organizationId: "0b8e7d14-5c2a-4f6b-8e3d-9a1c2b3d4e5f",
  organizationName: "Northwind",
};
const SUPPORT: DeletionBlocker = { kind: "SUPPORT_ADMIN" };

const DELETABLE: DeletionStatus = { canDelete: true, blockers: [], confirmation: "password" };

describe("deletionFailureOf", () => {
  it("returns a wrong password for a 403 PASSWORD_INVALID", () => {
    const failure = new ApiError(403, "The password is not correct", {
      reason: "PASSWORD_INVALID",
    });

    expect(deletionFailureOf(failure)).toEqual({ kind: "wrong-password" });
  });

  it("returns a fresh sign-in for a 403 REAUTH_REQUIRED", () => {
    const failure = new ApiError(403, "Sign in again", { reason: "REAUTH_REQUIRED" });

    expect(deletionFailureOf(failure)).toEqual({ kind: "reauth" });
  });

  it("returns every blocker a 409 DELETION_BLOCKED lists, dropping kinds it does not know", () => {
    const failure = new ApiError(409, "Blocked", {
      reason: "DELETION_BLOCKED",
      blockers: [GROUP, { kind: "SOMETHING_NEW" }, SUPPORT, "junk"],
    });

    expect(deletionFailureOf(failure)).toEqual({ kind: "blocked", blockers: [GROUP, SUPPORT] });
  });

  it("returns no answer for a request that never reached the server", () => {
    expect(deletionFailureOf(new TypeError("Network request failed"))).toEqual({
      kind: "unanswered",
    });
  });

  it("returns a server fault for a 5xx, leaving its raw words out", () => {
    expect(deletionFailureOf(new ApiError(503, "Down for maintenance"))).toEqual({
      kind: "server",
    });
  });

  it("returns the server's message for any other refusal", () => {
    expect(deletionFailureOf(new ApiError(429, "Too many requests"))).toEqual({
      kind: "refused",
      message: "Too many requests",
    });
  });

  it("returns nothing for a 401, which the signed-out wipe has already answered", () => {
    expect(deletionFailureOf(new ApiError(401, "Unauthorized"))).toBeNull();
  });
});

describe("statusAfterRefusal", () => {
  it("returns the 409's blockers in place of a status that let the delete through", () => {
    expect(statusAfterRefusal(DELETABLE, { kind: "blocked", blockers: [ORGANIZATION] })).toEqual({
      canDelete: false,
      blockers: [ORGANIZATION],
      confirmation: "password",
    });
  });

  it("returns the web's confirmation once the server asks for a fresh sign-in", () => {
    expect(statusAfterRefusal(DELETABLE, { kind: "reauth" })).toEqual({
      ...DELETABLE,
      confirmation: "recent-sign-in",
    });
  });

  it("returns the status unchanged for a 409 that names no blocker", () => {
    expect(statusAfterRefusal(DELETABLE, { kind: "blocked", blockers: [] })).toBe(DELETABLE);
  });

  it("returns the status unchanged for a wrong password", () => {
    expect(statusAfterRefusal(DELETABLE, { kind: "wrong-password" })).toBe(DELETABLE);
  });
});

describe("deletionView", () => {
  it("returns loading until the first answer", () => {
    expect(deletionView(undefined, false)).toEqual({ kind: "loading" });
  });

  it("returns unreachable when the check got no answer", () => {
    expect(deletionView(undefined, true)).toEqual({ kind: "unreachable" });
  });

  it("returns the blockers, and no way to delete, while any apply", () => {
    const status: DeletionStatus = {
      canDelete: false,
      blockers: [GROUP, SUBSCRIPTION],
      confirmation: "password",
    };

    expect(deletionView(status, false)).toEqual({
      kind: "blocked",
      blockers: [GROUP, SUBSCRIPTION],
    });
  });

  it("returns the password prompt for an account with a password", () => {
    expect(deletionView(DELETABLE, false)).toEqual({ kind: "password" });
  });

  it("returns the web hand-off for an account that needs a fresh sign-in", () => {
    expect(deletionView({ ...DELETABLE, confirmation: "recent-sign-in" }, false)).toEqual({
      kind: "web",
    });
  });

  it("returns the last answer when a later read fails", () => {
    expect(deletionView(DELETABLE, true)).toEqual({ kind: "password" });
  });
});

describe("blockerText", () => {
  it("returns the group's name and that its other members go first", () => {
    expect(blockerText(GROUP, en)).toBe(
      "You manage Design, which has 3 other members. Remove them from the group first."
    );
    expect(blockerText({ ...GROUP, otherMembers: 1 }, en)).toBe(
      "You manage Design, which has 1 other member. Remove them from the group first."
    );
  });

  it("returns the organization's name and that its other people go first", () => {
    expect(blockerText(ORGANIZATION, en)).toBe(
      "You own Northwind, which has 1 other person in it. Remove them from the organization first."
    );
  });

  it("returns that the subscription is cancelled on the web first", () => {
    expect(blockerText(SUBSCRIPTION, en)).toBe(
      "Northwind's subscription renews. Cancel it on the web first."
    );
  });

  it("returns that a support account is not deleted here", () => {
    expect(blockerText(SUPPORT, en)).toBe("This is a support account. It can't be deleted here.");
  });

  it("returns Czech wording with the Czech plural", () => {
    expect(blockerText({ ...GROUP, otherMembers: 1 }, cs)).toContain("1 dalšího člena");
    expect(blockerText({ ...GROUP, otherMembers: 3 }, cs)).toContain("3 další členy");
    expect(blockerText({ ...GROUP, otherMembers: 5 }, cs)).toContain("5 dalších členů");
  });
});

describe("blockerKey", () => {
  it("returns a key per blocker, apart even where two name the same organization", () => {
    const keys = [GROUP, ORGANIZATION, SUBSCRIPTION, SUPPORT].map(blockerKey);

    expect(new Set(keys).size).toBe(4);
    expect(keys).toEqual([
      "GROUP_HAS_MEMBERS-6f1c0a52-1b7e-4c38-9a0e-2d5f8c3b4a71",
      "ORGANIZATION_HAS_MEMBERS-0b8e7d14-5c2a-4f6b-8e3d-9a1c2b3d4e5f",
      "SUBSCRIPTION_RENEWING-0b8e7d14-5c2a-4f6b-8e3d-9a1c2b3d4e5f",
      "SUPPORT_ADMIN",
    ]);
  });
});
