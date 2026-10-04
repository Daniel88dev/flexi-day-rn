import {
  type AuthError,
  AuthRequest,
  exchangeCodeAsync,
  fetchDiscoveryAsync,
} from "expo-auth-session";
import { randomUUID } from "expo-crypto";
import { maybeCompleteAuthSession } from "expo-web-browser";

import { MICROSOFT_CLIENT_ID, MICROSOFT_REDIRECT_URI } from "@/lib/auth/provider-config";
import { createMicrosoftAdapter } from "@/lib/auth/providers/microsoft";

jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));

jest.mock("expo-auth-session", () => ({
  AuthRequest: jest.fn(),
  exchangeCodeAsync: jest.fn(),
  fetchDiscoveryAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));

const AuthRequestMock = jest.mocked(AuthRequest);
const exchange = jest.mocked(exchangeCodeAsync);
const fetchDiscovery = jest.mocked(fetchDiscoveryAsync);
const completeAuthSession = jest.mocked(maybeCompleteAuthSession);
const uuid = jest.mocked(randomUUID);

const discovery = {
  authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

type PromptResult = Awaited<ReturnType<AuthRequest["promptAsync"]>>;

type RedirectResult = Extract<PromptResult, { type: "success" | "error" }>;

const promptAsync = jest.fn<Promise<PromptResult>, [unknown]>();

function success(code: string | undefined): RedirectResult {
  return {
    type: "success",
    errorCode: null,
    error: null,
    params: code === undefined ? { state: "a-state" } : { code, state: "a-state" },
    authentication: null,
    url: `flexiday://auth?code=${code}&state=a-state`,
  };
}

function tokensWith(idToken: string | undefined) {
  return { accessToken: "an-access-token", idToken } as Awaited<
    ReturnType<typeof exchangeCodeAsync>
  >;
}

function requestConfig(call = 0) {
  return AuthRequestMock.mock.calls[call][0];
}

// The module-scope call runs once on import, before any test clears the mocks.
const completedOnImport = completeAuthSession.mock.calls.length;

beforeEach(() => {
  jest.clearAllMocks();
  let nonces = 0;
  uuid.mockImplementation(() => `nonce-${++nonces}` as ReturnType<typeof randomUUID>);
  fetchDiscovery.mockResolvedValue(discovery);
  AuthRequestMock.mockImplementation(
    () => ({ codeVerifier: "a-pkce-verifier", promptAsync }) as unknown as AuthRequest
  );
  promptAsync.mockResolvedValue({ type: "cancel" });
  exchange.mockResolvedValue(tokensWith("a-microsoft-id-token"));
});

describe("createMicrosoftAdapter", () => {
  it("returns an adapter that names microsoft as its provider", () => {
    expect(createMicrosoftAdapter().provider).toBe("microsoft");
  });

  it("completes a pending auth session once, when the module loads", () => {
    expect(completedOnImport).toBe(1);
  });

  it("reads the endpoints from the common tenant's discovery document", async () => {
    await createMicrosoftAdapter().signIn();

    expect(fetchDiscovery).toHaveBeenCalledWith("https://login.microsoftonline.com/common/v2.0");
    expect(promptAsync).toHaveBeenCalledWith(discovery);
  });

  it("reads the discovery document once across sign-ins", async () => {
    const adapter = createMicrosoftAdapter();

    await adapter.signIn();
    await adapter.signIn();

    expect(fetchDiscovery).toHaveBeenCalledTimes(1);
    expect(promptAsync).toHaveBeenCalledTimes(2);
  });

  it("requests the three OpenID scopes on the app's redirect with PKCE and a nonce", async () => {
    await createMicrosoftAdapter().signIn();

    const config = requestConfig();
    expect(config.clientId).toBe(MICROSOFT_CLIENT_ID);
    expect(config.redirectUri).toBe(MICROSOFT_REDIRECT_URI);
    expect(config.scopes).toEqual(["openid", "profile", "email"]);
    expect(config.usePKCE).toBe(true);
    expect(config.extraParams).toEqual({ nonce: "nonce-1" });
  });

  it("asks for no refresh token and sends no client secret", async () => {
    await createMicrosoftAdapter().signIn();

    const config = requestConfig();
    expect(config.scopes).not.toContain("offline_access");
    expect(config.clientSecret).toBeUndefined();
  });

  it("sends a fresh nonce with every sign-in", async () => {
    const adapter = createMicrosoftAdapter();

    await adapter.signIn();
    await adapter.signIn();

    expect(requestConfig(0).extraParams?.nonce).not.toBe(requestConfig(1).extraParams?.nonce);
  });

  it("exchanges the code with the request's PKCE verifier", async () => {
    promptAsync.mockResolvedValue(success("an-auth-code"));

    await createMicrosoftAdapter().signIn();

    expect(exchange).toHaveBeenCalledWith(
      {
        clientId: MICROSOFT_CLIENT_ID,
        code: "an-auth-code",
        redirectUri: MICROSOFT_REDIRECT_URI,
        extraParams: { code_verifier: "a-pkce-verifier" },
      },
      discovery
    );
  });

  it("returns the id token with the nonce the request carried", async () => {
    promptAsync.mockResolvedValue(success("an-auth-code"));

    const outcome = await createMicrosoftAdapter().signIn();

    expect(outcome).toEqual({ kind: "token", idToken: "a-microsoft-id-token", nonce: "nonce-1" });
    expect(requestConfig().extraParams).toEqual({ nonce: "nonce-1" });
  });

  it.each(["cancel", "dismiss"] as const)(
    "returns cancelled when the auth session ends with %s",
    async (type) => {
      promptAsync.mockResolvedValue({ type });

      await expect(createMicrosoftAdapter().signIn()).resolves.toEqual({ kind: "cancelled" });
      expect(exchange).not.toHaveBeenCalled();
    }
  );

  it("returns failed with Microsoft's error when the redirect carries one", async () => {
    const error = Object.assign(new Error("AADSTS50011: redirect mismatch"), {
      code: "invalid_request",
      params: { error: "invalid_request" },
    }) as unknown as AuthError;
    promptAsync.mockResolvedValue({ ...success(undefined), type: "error", error });

    await expect(createMicrosoftAdapter().signIn()).resolves.toEqual({ kind: "failed", error });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("returns failed when another auth session holds the lock", async () => {
    promptAsync.mockResolvedValue({ type: "locked" });

    const outcome = await createMicrosoftAdapter().signIn();

    expect(outcome.kind).toBe("failed");
    expect(exchange).not.toHaveBeenCalled();
  });

  it("returns failed when a successful redirect carries no code", async () => {
    promptAsync.mockResolvedValue(success(undefined));

    const outcome = await createMicrosoftAdapter().signIn();

    expect(outcome.kind).toBe("failed");
    expect(exchange).not.toHaveBeenCalled();
  });

  it("returns failed when the token response carries no id token", async () => {
    promptAsync.mockResolvedValue(success("an-auth-code"));
    exchange.mockResolvedValue(tokensWith(undefined));

    const outcome = await createMicrosoftAdapter().signIn();

    expect(outcome.kind).toBe("failed");
  });

  it("returns failed with the error when the code exchange rejects", async () => {
    promptAsync.mockResolvedValue(success("an-auth-code"));
    const error = new Error("invalid_grant");
    exchange.mockRejectedValue(error);

    await expect(createMicrosoftAdapter().signIn()).resolves.toEqual({ kind: "failed", error });
  });

  it("returns failed without opening a session when discovery cannot be read", async () => {
    const error = new Error("Network request failed");
    fetchDiscovery.mockRejectedValueOnce(error);

    await expect(createMicrosoftAdapter().signIn()).resolves.toEqual({ kind: "failed", error });
    expect(promptAsync).not.toHaveBeenCalled();
  });

  it("reads discovery again on the next sign-in after a failed read", async () => {
    fetchDiscovery.mockRejectedValueOnce(new Error("Network request failed"));
    const adapter = createMicrosoftAdapter();

    await adapter.signIn();
    await adapter.signIn();

    expect(fetchDiscovery).toHaveBeenCalledTimes(2);
    expect(promptAsync).toHaveBeenCalledTimes(1);
  });
});
