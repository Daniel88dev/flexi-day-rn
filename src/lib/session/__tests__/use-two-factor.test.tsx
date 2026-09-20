import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { RootRouteProvider, useRootRoute } from "@/lib/session/root-route-context";
import { showSignedOutNotice, signedOutNoticeShowing } from "@/lib/session/signed-out-notice";
import { useTwoFactor } from "@/lib/session/use-two-factor";
import { createFakeClock, type FakeClock } from "@/test-support/fake-clock";
import { fakeTwoFactorAuth, type TwoFactorMocks } from "@/test-support/two-factor";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

const replace = router.replace as jest.Mock;

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

jest.mock("@/lib/session/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyTotp: jest.fn(),
      verifyOtp: jest.fn(),
      verifyBackupCode: jest.fn(),
      sendOtp: jest.fn(),
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <RootRouteProvider route="welcome">
      <TranslationProvider>{children}</TranslationProvider>
    </RootRouteProvider>
  );
}

function renderTwoFactor(methods: string[], auth: TwoFactorMocks, clock: FakeClock) {
  return renderHook(
    () => ({ form: useTwoFactor({ methods, auth, clock }), route: useRootRoute() }),
    { wrapper }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useTwoFactor", () => {
  it("sends the emailed code once for an email-only enrollee and starts the cooldown", async () => {
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["otp"], auth, createFakeClock());

    await waitFor(() => expect(result.current.form.info).toBe(en.auth.twoFactor.sent));
    expect(auth.sendOtp).toHaveBeenCalledTimes(1);
    expect(result.current.form.method).toBe("otp");
    expect(result.current.form.cooldown).toBe(30);
  });

  it("counts the cooldown down and lets the code be resent when it reaches zero", async () => {
    const clock = createFakeClock();
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["otp"], auth, clock);

    await waitFor(() => expect(result.current.form.cooldown).toBe(30));

    await act(async () => {
      clock.advance(1000);
    });
    expect(result.current.form.cooldown).toBe(29);

    for (let second = 0; second < 29; second++) {
      await act(async () => {
        clock.advance(1000);
      });
    }
    expect(result.current.form.cooldown).toBe(0);

    await act(async () => {
      await result.current.form.sendOtp();
    });
    expect(auth.sendOtp).toHaveBeenCalledTimes(2);
    expect(result.current.form.cooldown).toBe(30);
  });

  it("sends nothing while the cooldown is still running", async () => {
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["otp"], auth, createFakeClock());

    await waitFor(() => expect(result.current.form.cooldown).toBe(30));
    expect(result.current.form.canResend).toBe(false);

    await act(async () => {
      await result.current.form.sendOtp();
    });

    expect(auth.sendOtp).toHaveBeenCalledTimes(1);
  });

  it("shows the unreachable copy when the send never reached the server", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const auth = fakeTwoFactorAuth({
      sendOtp: jest.fn().mockRejectedValue(new Error("Network request failed")),
    });
    const { result } = await renderTwoFactor(["otp"], auth, createFakeClock());

    await waitFor(() => expect(result.current.form.error).toBe(en.sync.unreachable));
    expect(result.current.form.cooldown).toBe(0);
    expect(result.current.form.canResend).toBe(true);
  });

  it("sends nothing when the authenticator is the method in use", async () => {
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["totp", "otp"], auth, createFakeClock());

    expect(result.current.form.method).toBe("totp");
    expect(result.current.form.description).toBe(en.auth.twoFactor.totpDescription);
    expect(auth.sendOtp).not.toHaveBeenCalled();
  });

  it("clears the code and the messages when the method changes", async () => {
    const auth = fakeTwoFactorAuth({
      verifyTotp: jest.fn().mockResolvedValue({ error: { status: 401, code: "INVALID_CODE" } }),
    });
    const { result } = await renderTwoFactor(["totp", "otp"], auth, createFakeClock());

    await act(async () => {
      result.current.form.setCode("123456");
    });
    await act(async () => {
      await result.current.form.submit();
    });
    expect(result.current.form.error).toBe(en.auth.twoFactor.errors.invalidCode);

    await act(async () => {
      result.current.form.setMethod("backup");
    });

    expect(result.current.form.code).toBe("");
    expect(result.current.form.error).toBeNull();
    expect(result.current.form.info).toBeNull();
    expect(result.current.form.description).toBe(en.auth.twoFactor.backupDescription);
  });

  it("verifies the backup code with the backup call", async () => {
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    await act(async () => {
      result.current.form.setMethod("backup");
    });
    await act(async () => {
      await result.current.form.submit("abcde-fghij");
    });

    expect(auth.verifyBackupCode).toHaveBeenCalledWith({ code: "abcde-fghij" });
  });

  it("lands on the dashboard once the server accepts the code", async () => {
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    await act(async () => {
      await result.current.form.submit("123456");
    });

    expect(auth.verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(result.current.route).toBe("signed-in");
  });

  it("shows the mapped message when the server refuses the code", async () => {
    const auth = fakeTwoFactorAuth({
      verifyTotp: jest.fn().mockResolvedValue({ error: { status: 401, code: "INVALID_CODE" } }),
    });
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    await act(async () => {
      await result.current.form.submit("000000");
    });

    expect(result.current.form.error).toBe(en.auth.twoFactor.errors.invalidCode);
    expect(result.current.form.challengeDead).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("marks the challenge dead when it has expired", async () => {
    const auth = fakeTwoFactorAuth({
      verifyTotp: jest
        .fn()
        .mockResolvedValue({ error: { status: 401, code: "INVALID_TWO_FACTOR_COOKIE" } }),
    });
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    await act(async () => {
      await result.current.form.submit("123456");
    });

    expect(result.current.form.error).toBe(en.auth.twoFactor.errors.challengeExpired);
    expect(result.current.form.challengeDead).toBe(true);
    expect(result.current.form.canSubmit).toBe(false);

    await act(async () => {
      await result.current.form.submit("123456");
    });
    expect(auth.verifyTotp).toHaveBeenCalledTimes(1);
  });

  it("keeps the emailed code alive when its attempts run out", async () => {
    const auth = fakeTwoFactorAuth({
      verifyOtp: jest.fn().mockResolvedValue({
        error: { status: 400, code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" },
      }),
    });
    const { result } = await renderTwoFactor(["otp"], auth, createFakeClock());

    await waitFor(() => expect(result.current.form.cooldown).toBe(30));
    await act(async () => {
      await result.current.form.submit("000000");
    });

    expect(result.current.form.error).toBe(en.auth.twoFactor.errors.tooManyAttemptsOtp);
    expect(result.current.form.challengeDead).toBe(false);
  });

  it("marks the challenge dead when a backup code runs the attempts out", async () => {
    const auth = fakeTwoFactorAuth({
      verifyBackupCode: jest.fn().mockResolvedValue({
        error: { status: 400, code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" },
      }),
    });
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    await act(async () => {
      result.current.form.setMethod("backup");
    });
    await act(async () => {
      await result.current.form.submit("abcde-fghij");
    });

    expect(result.current.form.error).toBe(en.auth.twoFactor.errors.tooManyAttempts);
    expect(result.current.form.challengeDead).toBe(true);
  });

  it("shows the unreachable copy when the request never reached the server", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const auth = fakeTwoFactorAuth({
      verifyTotp: jest.fn().mockRejectedValue(new Error("Network request failed")),
    });
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    await act(async () => {
      await result.current.form.submit("123456");
    });

    expect(result.current.form.error).toBe(en.sync.unreachable);
    expect(result.current.form.loading).toBe(false);
  });

  it("asks the server for nothing while no code is typed", async () => {
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    expect(result.current.form.canSubmit).toBe(false);
    await act(async () => {
      await result.current.form.submit();
    });

    expect(auth.verifyTotp).not.toHaveBeenCalled();
  });
});

describe("useTwoFactor, after a signed-out wipe", () => {
  it("clears the welcome notice the wipe left once the second factor is accepted", async () => {
    showSignedOutNotice();
    const auth = fakeTwoFactorAuth();
    const { result } = await renderTwoFactor(["totp"], auth, createFakeClock());

    await act(async () => {
      await result.current.form.submit("123456");
    });

    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(signedOutNoticeShowing()).toBe(false);
  });
});
