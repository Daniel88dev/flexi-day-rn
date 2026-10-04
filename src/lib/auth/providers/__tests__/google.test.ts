import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "@/lib/auth/provider-config";
import { createGoogleAdapter } from "@/lib/auth/providers/google";

const configure = jest.mocked(GoogleSignin.configure);
const signIn = jest.mocked(GoogleSignin.signIn);

function userWith(idToken: string | null) {
  return {
    type: "success" as const,
    data: {
      idToken,
      serverAuthCode: null,
      scopes: [],
      user: {
        id: "a-google-id",
        name: "Alice Doe",
        email: "alice@example.com",
        photo: null,
        familyName: "Doe",
        givenName: "Alice",
      },
    },
  };
}

const cancelled = { type: "cancelled" as const, data: null };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createGoogleAdapter", () => {
  it("returns an adapter that names google as its provider", () => {
    expect(createGoogleAdapter().provider).toBe("google");
  });

  it("configures the SDK with the web and iOS client ids before the first sheet", async () => {
    signIn.mockResolvedValue(cancelled);

    await createGoogleAdapter().signIn();

    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
    });
    expect(configure.mock.invocationCallOrder[0]).toBeLessThan(signIn.mock.invocationCallOrder[0]);
  });

  it("configures the SDK once across sign-ins", async () => {
    signIn.mockResolvedValue(cancelled);
    const adapter = createGoogleAdapter();

    await adapter.signIn();
    await adapter.signIn();

    expect(configure).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it("returns the id token and no nonce from a successful sign-in", async () => {
    signIn.mockResolvedValue(userWith("a-google-id-token"));

    const outcome = await createGoogleAdapter().signIn();

    expect(outcome).toEqual({ kind: "token", idToken: "a-google-id-token" });
    expect(outcome).not.toHaveProperty("nonce");
  });

  it("returns cancelled when the user closes the sheet", async () => {
    signIn.mockResolvedValue(cancelled);

    await expect(createGoogleAdapter().signIn()).resolves.toEqual({ kind: "cancelled" });
  });

  it("returns failed when a successful sign-in carries no id token", async () => {
    signIn.mockResolvedValue(userWith(null));

    const outcome = await createGoogleAdapter().signIn();

    expect(outcome.kind).toBe("failed");
  });

  it("returns failed with the SDK's error when the sheet rejects", async () => {
    const error = Object.assign(new Error("A sign-in is already in progress"), {
      code: "IN_PROGRESS",
    });
    signIn.mockRejectedValue(error);

    await expect(createGoogleAdapter().signIn()).resolves.toEqual({ kind: "failed", error });
  });

  it("returns failed when the SDK cannot be configured", async () => {
    const error = new Error("failed to determine clientID");
    configure.mockImplementationOnce(() => {
      throw error;
    });

    await expect(createGoogleAdapter().signIn()).resolves.toEqual({ kind: "failed", error });
    expect(signIn).not.toHaveBeenCalled();
  });
});
