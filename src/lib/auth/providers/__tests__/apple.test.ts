import { createHash } from "node:crypto";

import {
  AppleAuthenticationScope,
  signInAsync,
  type AppleAuthenticationCredential,
  type AppleAuthenticationFullName,
  type AppleAuthenticationSignInOptions,
} from "expo-apple-authentication";
import { digestStringAsync, randomUUID } from "expo-crypto";

import { createAppleAdapter } from "@/lib/auth/providers/apple";

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(),
  randomUUID: jest.fn(),
}));

const appleSignIn = jest.mocked(signInAsync);
const digest = jest.mocked(digestStringAsync);
const uuid = jest.mocked(randomUUID);

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function identityTokenFor(options: AppleAuthenticationSignInOptions | undefined): string {
  const claims = {
    iss: "https://appleid.apple.com",
    aud: "com.flexiday.app",
    nonce: options?.nonce,
  };
  return `${base64Url({ alg: "RS256", kid: "a-kid" })}.${base64Url(claims)}.a-signature`;
}

function claimsOf(token: string): { nonce?: string } {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}

function fullName(name: Partial<AppleAuthenticationFullName>): AppleAuthenticationFullName {
  return {
    namePrefix: null,
    givenName: null,
    middleName: null,
    familyName: null,
    nameSuffix: null,
    nickname: null,
    ...name,
  };
}

function credential(
  options: AppleAuthenticationSignInOptions | undefined,
  overrides: Partial<AppleAuthenticationCredential> = {}
): AppleAuthenticationCredential {
  return {
    user: "an-apple-subject",
    state: null,
    fullName: null,
    email: null,
    realUserStatus: 1,
    identityToken: identityTokenFor(options),
    authorizationCode: "an-authorization-code",
    ...overrides,
  };
}

function answering(overrides: Partial<AppleAuthenticationCredential> = {}) {
  appleSignIn.mockImplementation(async (options) => credential(options, overrides));
}

function requestOptions(call = 0): AppleAuthenticationSignInOptions | undefined {
  return appleSignIn.mock.calls[call][0];
}

function canceled(): Error {
  return Object.assign(new Error("The user canceled the authorization attempt"), {
    code: "ERR_REQUEST_CANCELED",
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  let nonces = 0;
  uuid.mockImplementation(() => `raw-nonce-${++nonces}` as ReturnType<typeof randomUUID>);
  digest.mockImplementation(async (_algorithm, data) => sha256Hex(data));
  answering();
});

describe("createAppleAdapter", () => {
  it("returns an adapter that names apple as its provider", () => {
    expect(createAppleAdapter().provider).toBe("apple");
  });

  it("requests the full name and the email with the SHA-256 hex of a random nonce", async () => {
    await createAppleAdapter().signIn();

    expect(digest).toHaveBeenCalledWith("SHA-256", "raw-nonce-1");
    expect(requestOptions()).toEqual({
      requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
      nonce: sha256Hex("raw-nonce-1"),
    });
  });

  it("sends a fresh nonce with every sign-in", async () => {
    const adapter = createAppleAdapter();

    await adapter.signIn();
    await adapter.signIn();

    expect(requestOptions(0)?.nonce).not.toBe(requestOptions(1)?.nonce);
  });

  it("returns the nonce the token's claim carries, which is the hash the request sent", async () => {
    const outcome = await createAppleAdapter().signIn();

    if (outcome.kind !== "token") throw new Error(`Expected a token, got ${outcome.kind}.`);
    expect(outcome.nonce).toBe(claimsOf(outcome.idToken).nonce);
    expect(outcome.nonce).toBe(sha256Hex("raw-nonce-1"));
    expect(outcome.nonce).not.toBe("raw-nonce-1");
  });

  it("returns the id token and the authorization code without a user when Apple sends no name", async () => {
    const outcome = await createAppleAdapter().signIn();

    expect(outcome).toEqual({
      kind: "token",
      idToken: identityTokenFor(requestOptions()),
      nonce: sha256Hex("raw-nonce-1"),
      authorizationCode: "an-authorization-code",
    });
    expect(outcome).not.toHaveProperty("user");
  });

  it("returns the given and family name as first and last name when Apple sends them", async () => {
    answering({ fullName: fullName({ givenName: "Alice", familyName: "Doe" }) });

    const outcome = await createAppleAdapter().signIn();

    expect(outcome).toMatchObject({
      kind: "token",
      user: { name: { firstName: "Alice", lastName: "Doe" } },
      authorizationCode: "an-authorization-code",
    });
  });

  it("returns only the part of the name Apple sent", async () => {
    answering({ fullName: fullName({ givenName: "Alice" }) });

    const outcome = await createAppleAdapter().signIn();

    expect(outcome).toMatchObject({ user: { name: { firstName: "Alice" } } });
    if (outcome.kind !== "token") throw new Error(`Expected a token, got ${outcome.kind}.`);
    expect(outcome.user?.name).not.toHaveProperty("lastName");
  });

  it("returns no user when the name Apple sent is empty", async () => {
    answering({ fullName: fullName({}) });

    const outcome = await createAppleAdapter().signIn();

    expect(outcome).not.toHaveProperty("user");
  });

  it("returns cancelled when the user closes the sheet", async () => {
    appleSignIn.mockRejectedValue(canceled());

    await expect(createAppleAdapter().signIn()).resolves.toEqual({ kind: "cancelled" });
  });

  it("returns failed with the SDK's error for any other rejection", async () => {
    const error = Object.assign(new Error("The authorization attempt failed"), {
      code: "ERR_REQUEST_FAILED",
    });
    appleSignIn.mockRejectedValue(error);

    await expect(createAppleAdapter().signIn()).resolves.toEqual({ kind: "failed", error });
  });

  it("returns failed when the credential carries no identity token", async () => {
    answering({ identityToken: null });

    const outcome = await createAppleAdapter().signIn();

    expect(outcome.kind).toBe("failed");
  });

  it("returns the token without an authorization code when the credential carries none", async () => {
    answering({ authorizationCode: null });

    const outcome = await createAppleAdapter().signIn();

    expect(outcome).toMatchObject({ kind: "token", idToken: identityTokenFor(requestOptions()) });
    expect(outcome).not.toHaveProperty("authorizationCode");
  });

  it("returns failed without opening the sheet when the nonce cannot be hashed", async () => {
    const error = new Error("digest unavailable");
    digest.mockRejectedValueOnce(error);

    await expect(createAppleAdapter().signIn()).resolves.toEqual({ kind: "failed", error });
    expect(appleSignIn).not.toHaveBeenCalled();
  });
});
