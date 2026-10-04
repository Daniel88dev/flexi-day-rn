import type { TokenOutcome } from "@/lib/auth/providers/types";
import type { ApiRequest } from "@/lib/query/request";
import { createSocialFollowUp } from "@/lib/session/social-follow-up";

jest.mock("@/lib/query/runtime", () => ({ apiRequest: jest.fn() }));

const WITH_CODE: TokenOutcome = {
  kind: "token",
  idToken: "an-apple-id-token",
  nonce: "a-hashed-nonce",
  authorizationCode: "an-authorization-code",
};

function requestAnswering(answer: Promise<unknown>) {
  return jest.fn(() => answer) as unknown as jest.MockedFunction<ApiRequest>;
}

describe("createSocialFollowUp", () => {
  it("posts Apple's authorization code to the backend once", async () => {
    const request = requestAnswering(Promise.resolve(undefined));

    await createSocialFollowUp(request)("apple", WITH_CODE);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("/api/users/me/apple-authorization", {
      method: "POST",
      body: { authorizationCode: "an-authorization-code" },
    });
  });

  it("posts nothing after an Apple sign-in that carried no code", async () => {
    const request = requestAnswering(Promise.resolve(undefined));
    const { authorizationCode: _omitted, ...withoutCode } = WITH_CODE;

    await createSocialFollowUp(request)("apple", withoutCode);

    expect(request).not.toHaveBeenCalled();
  });

  it.each(["google", "microsoft"] as const)(
    "posts nothing after a %s sign-in",
    async (provider) => {
      const request = requestAnswering(Promise.resolve(undefined));

      await createSocialFollowUp(request)(provider, WITH_CODE);

      expect(request).not.toHaveBeenCalled();
    }
  );

  it("rejects with the request's error so the caller decides what to do with it", async () => {
    const error = new Error("The server answered 502.");
    const request = requestAnswering(Promise.reject(error));

    await expect(createSocialFollowUp(request)("apple", WITH_CODE)).rejects.toBe(error);
  });
});
