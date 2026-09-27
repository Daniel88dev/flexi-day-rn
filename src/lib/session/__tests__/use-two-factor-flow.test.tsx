import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import type { TwoFactorFlow } from "@/lib/session/two-factor-settings";
import { useTwoFactorFlow, type TwoFactorSettingsAuth } from "@/lib/session/use-two-factor-flow";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("@/lib/session/auth-client", () => ({ authClient: {} }));
jest.mock("@/lib/session/signed-out-wipe", () => ({ useSignedOutWipe: () => jest.fn() }));

const URI =
  "otpauth://totp/Flexi%20Day:dana%40northwind.co?secret=JBSWY3DPEHPK3PXP&issuer=Flexi+Day&digits=6&period=30";
const CODES = ["aaaaa-bbbbb", "ccccc-ddddd"];
const copy = en.settings.twoFactor;

type Auth = TwoFactorSettingsAuth;

function answers<K extends keyof Auth>(answer: jest.ResolvedValue<ReturnType<Auth[K]>>) {
  return jest.fn<ReturnType<Auth[K]>, Parameters<Auth[K]>>().mockResolvedValue(answer);
}

function fakeAuth(): jest.Mocked<Auth> {
  return {
    enable: answers<"enable">({ data: { method: "totp", totpURI: URI, backupCodes: CODES } }),
    getTotpUri: answers<"getTotpUri">({ data: { totpURI: URI } }),
    generateBackupCodes: answers<"generateBackupCodes">({ data: { backupCodes: CODES } }),
    disable: answers<"disable">({ data: { status: true } }),
    sendOtp: answers<"sendOtp">({ data: { status: true } }),
    verifyTotp: answers<"verifyTotp">({ data: { token: "new" } }),
    verifyOtp: answers<"verifyOtp">({ data: { token: "new" } }),
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <TranslationProvider>{children}</TranslationProvider>;
}

async function renderFlow(flow: TwoFactorFlow, auth = fakeAuth()) {
  const refreshSession = jest.fn(async () => undefined);
  const hook = await renderHook(() => useTwoFactorFlow(flow, { auth, refreshSession }), {
    wrapper,
  });
  return { ...hook, auth, refreshSession };
}

type Flow = { current: ReturnType<typeof useTwoFactorFlow> };

async function enterPassword(result: Flow, password = "my password") {
  await act(async () => result.current.setPassword(password));
  await act(async () => {
    await result.current.submitPassword();
  });
}

async function run(result: Flow, action: (flow: ReturnType<typeof useTwoFactorFlow>) => unknown) {
  await act(async () => {
    await action(result.current);
  });
}

beforeEach(() => jest.clearAllMocks());

describe("useTwoFactorFlow", () => {
  it("enables with an authenticator: password, backup codes, method, code, then refreshes the session", async () => {
    const { result, auth, refreshSession } = await renderFlow("enable");

    await enterPassword(result);
    expect(auth.enable).toHaveBeenCalledWith({ password: "my password", method: "totp" });
    expect(result.current.state).toMatchObject({ step: "backupCodes", backupCodes: CODES });
    expect(result.current.password).toBe("");

    await run(result, (flow) => flow.saveCodes());
    expect(result.current.state.step).toBe("method");

    await run(result, (flow) => flow.chooseAuthenticator());
    expect(result.current.state.step).toBe("authenticator");
    expect(result.current.secret).toBe("JBSWY3DPEHPK3PXP");

    await run(result, (flow) => flow.verify("123456"));
    expect(auth.verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.state.step).toBe("done");
  });

  it("enables with an email code: sends it on choosing, verifies it, then refreshes the session", async () => {
    const { result, auth, refreshSession } = await renderFlow("enable");

    await enterPassword(result);
    await run(result, (flow) => flow.saveCodes());
    await run(result, (flow) => flow.chooseEmail());

    expect(auth.sendOtp).toHaveBeenCalledTimes(1);
    expect(result.current.state.step).toBe("emailCode");
    expect(result.current.info).toBe(copy.sent);

    await run(result, (flow) => flow.verify("654321"));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ code: "654321" });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.state.step).toBe("done");
  });

  it("stays on the method choice when the email code cannot be sent", async () => {
    const auth = fakeAuth();
    auth.sendOtp.mockResolvedValue({ error: { status: 500 } });
    const { result } = await renderFlow("enable", auth);

    await enterPassword(result);
    await run(result, (flow) => flow.saveCodes());
    await run(result, (flow) => flow.chooseEmail());

    expect(result.current.state.step).toBe("method");
    expect(result.current.error).toBe(copy.errors.sendFailed);
  });

  it("shows a wrong password under the password field and stays on the step", async () => {
    const auth = fakeAuth();
    auth.disable.mockResolvedValue({
      error: { status: 400, code: "INVALID_PASSWORD", message: "Invalid password" },
    });
    const { result, refreshSession } = await renderFlow("disable", auth);

    await enterPassword(result, "wrong");

    expect(result.current.passwordError).toBe(copy.errors.wrongPassword);
    expect(result.current.error).toBeNull();
    expect(result.current.state.step).toBe("password");
    expect(refreshSession).not.toHaveBeenCalled();

    await act(async () => result.current.setPassword("wrong again"));
    expect(result.current.passwordError).toBeNull();
  });

  it("disables with the password, then refreshes the session", async () => {
    const { result, auth, refreshSession } = await renderFlow("disable");

    await enterPassword(result);

    expect(auth.disable).toHaveBeenCalledWith({ password: "my password" });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.state.step).toBe("done");
  });

  it("reads the session back after a 5xx from disable, which may have swapped it already", async () => {
    const auth = fakeAuth();
    auth.disable.mockResolvedValue({ error: { status: 500 } });
    const { result, refreshSession } = await renderFlow("disable", auth);

    await enterPassword(result);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(copy.errors.actionFailed);
  });

  it("hands a 401 to the session lookup and shows nothing of its own", async () => {
    const auth = fakeAuth();
    auth.generateBackupCodes.mockResolvedValue({ error: { status: 401, message: "Unauthorized" } });
    const { result, refreshSession } = await renderFlow("backupCodes", auth);

    await enterPassword(result);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.passwordError).toBeNull();
  });

  it("shows fresh backup codes without touching the session", async () => {
    const { result, auth, refreshSession } = await renderFlow("backupCodes");

    await enterPassword(result);

    expect(auth.generateBackupCodes).toHaveBeenCalledWith({ password: "my password" });
    expect(result.current.state).toMatchObject({ step: "backupCodes", backupCodes: CODES });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("sets up an authenticator from the existing secret without refreshing the session", async () => {
    const { result, auth, refreshSession } = await renderFlow("authenticator");

    await enterPassword(result);
    expect(auth.getTotpUri).toHaveBeenCalledWith({ password: "my password" });
    expect(auth.enable).not.toHaveBeenCalled();
    expect(result.current.state.step).toBe("authenticator");

    await run(result, (flow) => flow.verify("123456"));
    expect(result.current.state.step).toBe("done");
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("shows a refused code under the code, clears it and stays on the step", async () => {
    const auth = fakeAuth();
    auth.verifyTotp.mockResolvedValue({ error: { status: 401, code: "INVALID_CODE" } });
    const { result, refreshSession } = await renderFlow("authenticator", auth);

    await enterPassword(result);
    await act(async () => result.current.setCode("111111"));
    await run(result, (flow) => flow.verify());

    expect(result.current.codeError).toBe(en.auth.twoFactor.errors.invalidCode);
    expect(result.current.code).toBe("");
    expect(result.current.state.step).toBe("authenticator");
    // A refused code is not a lost session, whatever its status.
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("hands a code check that found no session to the session lookup and shows nothing", async () => {
    const auth = fakeAuth();
    auth.verifyTotp.mockResolvedValue({
      error: {
        status: 401,
        code: "INVALID_TWO_FACTOR_COOKIE",
        message: "Invalid two factor cookie",
      },
    });
    const { result, refreshSession } = await renderFlow("enable", auth);

    await enterPassword(result);
    await run(result, (flow) => flow.saveCodes());
    await run(result, (flow) => flow.chooseAuthenticator());
    await run(result, (flow) => flow.verify("123456"));

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.codeError).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("reads the session back after a 5xx from enable-verify, which may have swapped it already", async () => {
    const auth = fakeAuth();
    auth.verifyOtp.mockResolvedValue({ error: { status: 500 } });
    const { result, refreshSession } = await renderFlow("enable", auth);

    await enterPassword(result);
    await run(result, (flow) => flow.saveCodes());
    await run(result, (flow) => flow.chooseEmail());
    await run(result, (flow) => flow.verify("654321"));

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.codeError).toBe(en.auth.twoFactor.errors.generic);
    expect(result.current.state.step).toBe("emailCode");
  });

  it("tells spent attempts to ask for a new code rather than to sign in again", async () => {
    const auth = fakeAuth();
    auth.verifyOtp.mockResolvedValue({
      error: { status: 400, code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE" },
    });
    const { result } = await renderFlow("enable", auth);

    await enterPassword(result);
    await run(result, (flow) => flow.saveCodes());
    await run(result, (flow) => flow.chooseEmail());
    await run(result, (flow) => flow.verify("000000"));

    expect(result.current.codeError).toBe(en.auth.twoFactor.errors.tooManyAttemptsOtp);
  });

  it("shows the unreachable message when the request never arrives", async () => {
    const auth = fakeAuth();
    auth.enable.mockRejectedValue(new TypeError("Network request failed"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = await renderFlow("enable", auth);

    await enterPassword(result);

    expect(result.current.error).toBe(en.sync.unreachable);
    expect(result.current.busy).toBe(false);
  });

  it("does not send an empty password", async () => {
    const { result, auth } = await renderFlow("disable");

    await run(result, (flow) => flow.submitPassword());

    expect(auth.disable).not.toHaveBeenCalled();
    expect(result.current.canSubmitPassword).toBe(false);
  });
});
