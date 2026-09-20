import { act, renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { useRootRoute, RootRouteProvider } from "@/lib/session/root-route-context";
import { showSignedOutNotice, signedOutNoticeShowing } from "@/lib/session/signed-out-notice";
import { useSignIn, type SignInAnswer, type SignInWithEmail } from "@/lib/session/use-sign-in";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

jest.mock("@/lib/session/auth-client", () => ({
  authClient: { signIn: { email: jest.fn() } },
}));

const replace = router.replace as jest.Mock;
const push = router.push as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <RootRouteProvider route="welcome">
      <TranslationProvider>{children}</TranslationProvider>
    </RootRouteProvider>
  );
}

function signInWith(signIn: SignInWithEmail) {
  return renderHook(() => ({ form: useSignIn(signIn), route: useRootRoute() }), { wrapper });
}

type Form = { setEmail: (value: string) => void; setPassword: (value: string) => void };

async function fillIn(form: Form, email: string, password: string) {
  await act(async () => {
    form.setEmail(email);
    form.setPassword(password);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useSignIn", () => {
  it("replaces to the dashboard once the server hands back a session", async () => {
    const signIn: SignInWithEmail = jest.fn().mockResolvedValue({ data: { token: "a-token" } });
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(signIn).toHaveBeenCalledWith({ email: "owner@dev.local", password: "a-password" });
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(result.current.route).toBe("signed-in");
  });

  it("pushes the two-factor route with the offered methods as a comma list", async () => {
    const signIn: SignInWithEmail = jest.fn().mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ["totp", "otp"] },
    });
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(push).toHaveBeenCalledWith("/two-factor?methods=totp%2Cotp");
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.route).toBe("welcome");
  });

  it("pushes the two-factor route with no methods when the server offered none", async () => {
    const signIn: SignInWithEmail = jest
      .fn()
      .mockResolvedValue({ data: { twoFactorRedirect: true } });
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(push).toHaveBeenCalledWith("/two-factor?methods=");
  });

  it("shows the server's own message when it refuses the credentials", async () => {
    const signIn: SignInWithEmail = jest
      .fn()
      .mockResolvedValue({ error: { message: "Invalid email or password" } });
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(result.current.form.error).toBe("Invalid email or password");
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.form.loading).toBe(false);
  });

  it("shows the generic copy when the server refused without a message", async () => {
    const signIn: SignInWithEmail = jest.fn().mockResolvedValue({ error: {} });
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(result.current.form.error).toBe(en.auth.signIn.failed);
  });

  it("shows the unreachable copy when the request never reached the server", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const signIn: SignInWithEmail = jest
      .fn()
      .mockRejectedValue(new Error("Network request failed"));
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(result.current.form.error).toBe(en.sync.unreachable);
  });

  it("refuses to submit while either field is empty", async () => {
    const signIn: SignInWithEmail = jest.fn();
    const { result } = await signInWith(signIn);

    expect(result.current.form.canSubmit).toBe(false);

    await fillIn(result.current.form, "   ", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(signIn).not.toHaveBeenCalled();
    expect(result.current.form.canSubmit).toBe(false);
  });

  it("reports itself loading while the request is in flight", async () => {
    let answer: (result: SignInAnswer) => void = () => {};
    const signIn: SignInWithEmail = jest.fn(
      () =>
        new Promise<SignInAnswer>((resolve) => {
          answer = resolve;
        })
    );
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    let submitted: Promise<void> = Promise.resolve();
    await act(async () => {
      submitted = result.current.form.submit();
    });

    expect(result.current.form.loading).toBe(true);
    expect(result.current.form.canSubmit).toBe(false);

    await act(async () => {
      answer({ error: { message: "Invalid email or password" } });
      await submitted;
    });

    expect(result.current.form.loading).toBe(false);
  });
});

describe("useSignIn, after a signed-out wipe", () => {
  it("clears the welcome notice the wipe left once the session is back", async () => {
    showSignedOutNotice();
    const signIn: SignInWithEmail = jest.fn().mockResolvedValue({ data: { token: "a-token" } });
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(signedOutNoticeShowing()).toBe(false);
  });

  it("leaves the notice up while the server refuses the credentials", async () => {
    showSignedOutNotice();
    const signIn: SignInWithEmail = jest
      .fn()
      .mockResolvedValue({ error: { message: "Invalid email or password" } });
    const { result } = await signInWith(signIn);

    await fillIn(result.current.form, "owner@dev.local", "a-password");
    await act(async () => {
      await result.current.form.submit();
    });

    expect(signedOutNoticeShowing()).toBe(true);
  });
});
