import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import {
  alreadyMemberGroup,
  closedInvite,
  inviteMissing,
  joinRefusal,
  joinScreenAction,
  parseInviteInput,
} from "@/lib/groups/invites";
import { ApiError } from "@/lib/query/failure";

describe("parseInviteInput", () => {
  it("returns null for blank input", () => {
    expect(parseInviteInput("")).toBeNull();
    expect(parseInviteInput("   ")).toBeNull();
  });

  it("returns a code as typed, in any case and with or without dashes", () => {
    expect(parseInviteInput("7KQ2-M9PX-4HRT")).toEqual({ kind: "code", code: "7KQ2-M9PX-4HRT" });
    expect(parseInviteInput("7kq2m9px4hrt")).toEqual({ kind: "code", code: "7kq2m9px4hrt" });
    expect(parseInviteInput("  7kq2-M9px-4HRT  ")).toEqual({
      kind: "code",
      code: "7kq2-M9px-4HRT",
    });
  });

  it("returns the token of a link with a scheme", () => {
    expect(parseInviteInput("https://www.flexi-day.com/join/?token=abc123")).toEqual({
      kind: "link",
      token: "abc123",
    });
  });

  it("returns the token of a link pasted without its scheme", () => {
    expect(parseInviteInput("www.flexi-day.com/join/?token=abc123")).toEqual({
      kind: "link",
      token: "abc123",
    });
  });

  it("reads /join with and without its trailing slash", () => {
    expect(parseInviteInput("https://www.flexi-day.com/join?token=abc")).toEqual({
      kind: "link",
      token: "abc",
    });
    expect(parseInviteInput("https://www.flexi-day.com/join/?token=abc")).toEqual({
      kind: "link",
      token: "abc",
    });
  });

  it("finds the token among other parameters and decodes it", () => {
    expect(
      parseInviteInput("http://localhost:3000/join/?utm_source=mail&token=a%2Bb%20c#top")
    ).toEqual({ kind: "link", token: "a+b c" });
  });

  it("returns a broken link for a join path without a token", () => {
    expect(parseInviteInput("https://www.flexi-day.com/join/")).toEqual({ kind: "broken-link" });
    expect(parseInviteInput("https://www.flexi-day.com/join/?token=")).toEqual({
      kind: "broken-link",
    });
    expect(parseInviteInput("www.flexi-day.com/join?other=1")).toEqual({ kind: "broken-link" });
  });

  it("treats any other URL as a code", () => {
    expect(parseInviteInput("https://www.flexi-day.com/groups/?token=abc")).toEqual({
      kind: "code",
      code: "https://www.flexi-day.com/groups/?token=abc",
    });
    expect(parseInviteInput("https://www.flexi-day.com/join/extra?token=abc")).toEqual({
      kind: "code",
      code: "https://www.flexi-day.com/join/extra?token=abc",
    });
  });
});

const refused = (status: number, context?: Record<string, unknown>) =>
  new ApiError(status, "The server's own words", context);

describe("joinRefusal", () => {
  const errors = en.join.errors;

  it("returns the inline line for each invite code the backend sends", () => {
    const cases: [ApiError, string][] = [
      [refused(404, { code: "INVITE_NOT_FOUND" }), errors.notFound],
      [refused(410, { code: "INVITE_USED" }), errors.used],
      [refused(410, { code: "INVITE_EXPIRED" }), errors.expired],
      [refused(410, { code: "INVITE_REVOKED" }), errors.revoked],
      [refused(403, { code: "INVITE_EMAIL_MISMATCH" }), errors.emailMismatch],
      [refused(403, { code: "EMAIL_NOT_VERIFIED_USE_INVITE_LINK" }), errors.unverified],
    ];
    for (const [failure, line] of cases) {
      expect(joinRefusal(failure, "link", en)).toEqual({ kind: "inline", message: line });
      expect(joinRefusal(failure, "code", en)).toEqual({ kind: "inline", message: line });
    }
  });

  it("returns the not-found line for a 404 on a code without an invite code", () => {
    expect(joinRefusal(refused(404), "code", en)).toEqual({
      kind: "inline",
      message: errors.notFound,
    });
  });

  it("returns the different-address line for a 403 on a code without an invite code", () => {
    expect(joinRefusal(refused(403), "code", en)).toEqual({
      kind: "inline",
      message: errors.emailMismatch,
    });
  });

  it("returns the malformed line for a 400 on a code", () => {
    expect(joinRefusal(refused(400), "code", en)).toEqual({
      kind: "inline",
      message: errors.malformedCode,
    });
  });

  it("returns the broken-link line for a 422 on a link, whose token the server would not read", () => {
    expect(joinRefusal(refused(422), "link", en)).toEqual({
      kind: "inline",
      message: errors.brokenLink,
    });
    expect(joinRefusal(refused(422), "code", en)).toEqual({ kind: "unmapped" });
  });

  it("leaves a bare 400, 403 or 404 on a link unmapped", () => {
    expect(joinRefusal(refused(400), "link", en)).toEqual({ kind: "unmapped" });
    expect(joinRefusal(refused(403), "link", en)).toEqual({ kind: "unmapped" });
    expect(joinRefusal(refused(404), "link", en)).toEqual({ kind: "unmapped" });
  });

  it("returns the booking form's plan lines for a 402 by its context reason", () => {
    expect(joinRefusal(refused(402, { reason: "READ_ONLY" }), "code", en)).toEqual({
      kind: "inline",
      message: en.newRequest.readOnlyGroup,
    });
    expect(joinRefusal(refused(402, { reason: "PLAN_LIMIT", limit: 5 }), "link", en)).toEqual({
      kind: "inline",
      message: en.newRequest.memberLimitReached(5),
    });
    expect(joinRefusal(refused(402, { reason: "SOMETHING_NEW" }), "code", en)).toEqual({
      kind: "unmapped",
    });
  });

  it("returns the group of an ALREADY_MEMBER answer", () => {
    expect(
      joinRefusal(refused(409, { code: "ALREADY_MEMBER", groupId: "group-1" }), "code", en)
    ).toEqual({ kind: "already-member", groupId: "group-1" });
  });

  it("leaves every other failure unmapped", () => {
    expect(joinRefusal(refused(409), "code", en)).toEqual({ kind: "unmapped" });
    expect(joinRefusal(refused(409, { code: "ALREADY_MEMBER" }), "code", en)).toEqual({
      kind: "unmapped",
    });
    expect(joinRefusal(refused(429), "link", en)).toEqual({ kind: "unmapped" });
    expect(joinRefusal(refused(500), "code", en)).toEqual({ kind: "unmapped" });
    expect(joinRefusal(new TypeError("Network request failed"), "code", en)).toEqual({
      kind: "unmapped",
    });
  });

  it("returns the Czech lines from the Czech dictionary", () => {
    expect(joinRefusal(refused(410, { code: "INVITE_USED" }), "link", cs)).toEqual({
      kind: "inline",
      message: cs.join.errors.used,
    });
  });
});

describe("alreadyMemberGroup", () => {
  it("returns the group id of a 409 ALREADY_MEMBER", () => {
    expect(alreadyMemberGroup(refused(409, { code: "ALREADY_MEMBER", groupId: "g" }))).toBe("g");
  });

  it("returns null for anything else", () => {
    expect(alreadyMemberGroup(refused(409, { code: "ALREADY_MEMBER" }))).toBeNull();
    expect(alreadyMemberGroup(refused(403, { code: "ALREADY_MEMBER", groupId: "g" }))).toBeNull();
    expect(alreadyMemberGroup(new Error("boom"))).toBeNull();
  });
});

describe("closedInvite", () => {
  it("returns the status a 410 names", () => {
    expect(closedInvite(refused(410, { code: "INVITE_USED" }))).toBe("used");
    expect(closedInvite(refused(410, { code: "INVITE_EXPIRED" }))).toBe("expired");
    expect(closedInvite(refused(410, { code: "INVITE_REVOKED" }))).toBe("revoked");
  });

  it("returns null for anything else", () => {
    expect(closedInvite(refused(410))).toBeNull();
    expect(closedInvite(refused(410, { code: "SOMETHING_NEW" }))).toBeNull();
    expect(closedInvite(refused(404, { code: "INVITE_USED" }))).toBeNull();
    expect(closedInvite(new Error("boom"))).toBeNull();
  });
});

describe("inviteMissing", () => {
  it("returns true for a 404, and for a 422 on a token cut short", () => {
    expect(inviteMissing(refused(404, { code: "INVITE_NOT_FOUND" }))).toBe(true);
    expect(inviteMissing(refused(422))).toBe(true);
  });

  it("returns false for no answer and for any other failure", () => {
    expect(inviteMissing(new TypeError("Network request failed"))).toBe(false);
    expect(inviteMissing(refused(429))).toBe(false);
    expect(inviteMissing(refused(503))).toBe(false);
  });
});

describe("joinScreenAction", () => {
  const invite = { groupId: "group-2", invitedEmail: "alice@dev.local" };

  it("returns already-member when the store holds the viewer's membership in the group", () => {
    expect(joinScreenAction(invite, ["group-1", "group-2"], "alice@dev.local")).toBe(
      "already-member"
    );
    expect(joinScreenAction(invite, ["group-2"], "bob@dev.local")).toBe("already-member");
  });

  it("returns join for the invited address, compared without letter case", () => {
    expect(joinScreenAction(invite, ["group-1"], "alice@dev.local")).toBe("join");
    expect(joinScreenAction(invite, [], "Alice@Dev.Local")).toBe("join");
  });

  it("returns wrong-account for another address", () => {
    expect(joinScreenAction(invite, ["group-1"], "bob@dev.local")).toBe("wrong-account");
  });

  it("returns join for an invite without an address, whoever is signed in", () => {
    expect(joinScreenAction({ ...invite, invitedEmail: null }, [], "bob@dev.local")).toBe("join");
  });

  it("returns join while the viewer's address is unknown, leaving the check to the backend", () => {
    expect(joinScreenAction(invite, [], null)).toBe("join");
  });
});
