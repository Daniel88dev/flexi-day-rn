import { act, renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import type { ProviderAdapter, ProviderOutcome, SocialProvider } from "@/lib/auth/providers/types";
import { useRootRoute, RootRouteProvider } from "@/lib/session/root-route-context";
import { showSignedOutNotice, signedOutNoticeShowing } from "@/lib/session/signed-out-notice";
import {
  useSocialSignIn,
  type AfterSocialSignIn,
  type RequestSocialSignIn,
  type SocialSignInAnswer,
} from "@/lib/session/use-social-sign-in";
import { openWebPage } from "@/lib/web";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

jest.mock("@/lib/session/auth-client", () => ({
  authClient: { signIn: { email: jest.fn(), social: jest.fn() } },
}));

jest.mock("@/lib/web", () => ({
  openWebPage: jest.fn(),
  WEB_PATHS: jest.requireActual("@/lib/web").WEB_PATHS,
}));

const replace = router.replace as jest.Mock;
const openPage = openWebPage as jest.MockedFunction<typeof openWebPage>;

const TOKEN: ProviderOutcome = {
  kind: "token",
  idToken: "an-id-token",
  nonce: "a-nonce",
  user: { name: { firstName: "Alice", lastName: "Doe" } },
  authorizationCode: "an-authorization-code",
};

function adapter(provider: SocialProvider, outcome: ProviderOutcome): ProviderAdapter {
  return { provider, signIn: jest.fn().mockResolvedValue(outcome) };
}

function adaptersAnswering(outcome: ProviderOutcome): Record<SocialProvider, ProviderAdapter> {
  return {
    apple: adapter("apple", outcome),
    google: adapter("google", outcome),
    microsoft: adapter("microsoft", outcome),
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <RootRouteProvider route="welcome">
      <TranslationProvider>{children}</TranslationProvider>
    </RootRouteProvider>
  );
}

function renderSocial(options: Parameters<typeof useSocialSignIn>[0]) {
  return renderHook(() => ({ social: useSocialSignIn(options), route: useRootRoute() }), {
    wrapper,
  });
}

const signedIn: SocialSignInAnswer = { data: { token: "a-session-token" } };
const notLinked: SocialSignInAnswer = {
  error: { status: 401, code: "OAUTH_LINK_ERROR", message: "account not linked" },
};

beforeEach(() => {
  jest.clearAllMocks();
  openPage.mockResolvedValue(undefined);
});

describe("useSocialSignIn", () => {
  it("sends the adapter's token to signIn.social and nothing else", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(signedIn);
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("apple");
    });

    expect(requestSocialSignIn).toHaveBeenCalledTimes(1);
    expect(requestSocialSignIn).toHaveBeenCalledWith({
      provider: "apple",
      idToken: {
        token: "an-id-token",
        nonce: "a-nonce",
        user: { name: { firstName: "Alice", lastName: "Doe" } },
      },
    });
    const [request] = (requestSocialSignIn as jest.Mock).mock.calls[0];
    expect(Object.keys(request).sort()).toEqual(["idToken", "provider"]);
    expect(Object.keys(request.idToken).sort()).toEqual(["nonce", "token", "user"]);
  });

  it("replaces to the dashboard and marks the root signed in once a session comes back", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(signedIn);
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });

    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(result.current.route).toBe("signed-in");
    expect(result.current.social.notice).toBeNull();
  });

  it("clears the welcome notice a signed-out wipe left", async () => {
    showSignedOutNotice();
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(signedIn);
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("microsoft");
    });

    expect(signedOutNoticeShowing()).toBe(false);
  });

  it("runs the follow-up with the provider and its outcome after landing, without waiting", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(signedIn);
    const afterSignIn: AfterSocialSignIn = jest.fn(() => new Promise<void>(() => {}));
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
      afterSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("apple");
    });

    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(afterSignIn).toHaveBeenCalledTimes(1);
    expect(afterSignIn).toHaveBeenCalledWith("apple", TOKEN);
  });

  it("changes nothing on screen when the follow-up fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(signedIn);
    const afterSignIn: AfterSocialSignIn = jest.fn().mockRejectedValue(new Error("offline"));
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
      afterSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("apple");
    });

    expect(result.current.social.notice).toBeNull();
    expect(result.current.route).toBe("signed-in");
    expect(warn).toHaveBeenCalled();
  });

  it("names the tapped provider when the address already has a password account", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(notLinked);
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("microsoft");
    });

    expect(result.current.social.notice?.message).toBe(
      en.auth.signIn.accountNotLinked("Microsoft")
    );
    expect(result.current.social.notice?.action?.label).toBe(en.auth.signIn.openSettings);
    expect(result.current.social.notice?.action?.testID).toBe("sign-in-notice-action");
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.route).toBe("welcome");
    expect(result.current.social.pending).toBeNull();
  });

  it("opens Settings on the web from the not-linked notice", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(notLinked);
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });
    await act(async () => result.current.social.notice?.action?.onPress());

    expect(openPage).toHaveBeenCalledWith("/settings/");
  });

  it("shows the generic copy for a 401 that is not the link error", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest
      .fn()
      .mockResolvedValue({ error: { status: 401, code: "INVALID_TOKEN", message: "Invalid" } });
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });

    expect(result.current.social.notice).toEqual({ message: en.auth.signIn.generic });
  });

  it("shows the generic copy for the link error code on another status", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest
      .fn()
      .mockResolvedValue({ error: { status: 400, code: "OAUTH_LINK_ERROR" } });
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });

    expect(result.current.social.notice).toEqual({ message: en.auth.signIn.generic });
  });

  it("shows the cancelled copy and asks the server nothing when the sheet is cancelled", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn();
    const { result } = await renderSocial({
      adapters: adaptersAnswering({ kind: "cancelled" }),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("apple");
    });

    expect(requestSocialSignIn).not.toHaveBeenCalled();
    expect(result.current.social.notice).toEqual({ message: en.auth.signIn.cancelled });
    expect(result.current.social.pending).toBeNull();
  });

  it("shows the generic copy and asks the server nothing when the provider fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const requestSocialSignIn: RequestSocialSignIn = jest.fn();
    const { result } = await renderSocial({
      adapters: adaptersAnswering({ kind: "failed", error: new Error("no SDK") }),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });

    expect(requestSocialSignIn).not.toHaveBeenCalled();
    expect(result.current.social.notice).toEqual({ message: en.auth.signIn.generic });
  });

  it("treats an adapter that throws as a failed provider", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const throwing: ProviderAdapter = {
      provider: "google",
      signIn: jest.fn().mockRejectedValue(new Error("native module missing")),
    };
    const requestSocialSignIn: RequestSocialSignIn = jest.fn();
    const { result } = await renderSocial({
      adapters: { ...adaptersAnswering(TOKEN), google: throwing },
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });

    expect(requestSocialSignIn).not.toHaveBeenCalled();
    expect(result.current.social.notice).toEqual({ message: en.auth.signIn.generic });
    expect(result.current.social.pending).toBeNull();
  });

  it("shows the unreachable copy when the request never reached the server", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const requestSocialSignIn: RequestSocialSignIn = jest
      .fn()
      .mockRejectedValue(new Error("Network request failed"));
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("microsoft");
    });

    expect(result.current.social.notice).toEqual({ message: en.sync.unreachable });
    expect(replace).not.toHaveBeenCalled();
  });

  it("clears the last notice when another provider is tapped", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest
      .fn()
      .mockResolvedValueOnce(notLinked)
      .mockReturnValueOnce(new Promise<SocialSignInAnswer>(() => {}));
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });
    expect(result.current.social.notice).not.toBeNull();

    await act(async () => {
      void result.current.social.signIn("apple");
    });

    expect(result.current.social.notice).toBeNull();
  });

  it("runs one provider at a time and reports which one is in flight", async () => {
    let answer: (value: SocialSignInAnswer) => void = () => {};
    const requestSocialSignIn: RequestSocialSignIn = jest.fn(
      () =>
        new Promise<SocialSignInAnswer>((resolve) => {
          answer = resolve;
        })
    );
    const adapters = adaptersAnswering(TOKEN);
    const { result } = await renderSocial({ adapters, requestSocialSignIn });

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.social.signIn("google");
    });

    expect(result.current.social.pending).toBe("google");

    await act(async () => {
      await result.current.social.signIn("apple");
    });

    expect(adapters.apple.signIn).not.toHaveBeenCalled();
    expect(requestSocialSignIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer(notLinked);
      await first;
    });

    expect(result.current.social.pending).toBeNull();
  });

  it("refuses a second tap that lands before the first one re-rendered", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn(
      () => new Promise<SocialSignInAnswer>(() => {})
    );
    const adapters = adaptersAnswering(TOKEN);
    const { result } = await renderSocial({ adapters, requestSocialSignIn });

    await act(async () => {
      void result.current.social.signIn("google");
      void result.current.social.signIn("google");
    });

    expect(adapters.google.signIn).toHaveBeenCalledTimes(1);
  });

  it("keeps the in-flight state once signed in, because the screen is on its way out", async () => {
    const requestSocialSignIn: RequestSocialSignIn = jest.fn().mockResolvedValue(signedIn);
    const { result } = await renderSocial({
      adapters: adaptersAnswering(TOKEN),
      requestSocialSignIn,
    });

    await act(async () => {
      await result.current.social.signIn("google");
    });

    expect(result.current.social.pending).toBe("google");
  });
});
