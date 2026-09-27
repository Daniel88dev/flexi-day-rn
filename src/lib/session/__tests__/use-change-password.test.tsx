import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { authClient } from "@/lib/session/auth-client";
import {
  useChangePassword,
  useRefreshSession,
  type ChangePassword,
  type ChangePasswordAnswer,
} from "@/lib/session/use-change-password";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("@/lib/session/auth-client", () => ({
  authClient: { changePassword: jest.fn(), getSession: jest.fn() },
}));
const mockWipe = jest.fn(async () => undefined);
jest.mock("@/lib/session/signed-out-wipe", () => ({ useSignedOutWipe: () => mockWipe }));

const getSession = authClient.getSession as unknown as jest.Mock;

beforeEach(() => jest.clearAllMocks());

const errors = en.settings.password.errors;

function wrapper({ children }: { children: ReactNode }) {
  return <TranslationProvider>{children}</TranslationProvider>;
}

async function renderForm(answer: ChangePasswordAnswer | Error = { data: { token: "new" } }) {
  const change = jest.fn<ReturnType<ChangePassword>, Parameters<ChangePassword>>(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const refreshSession = jest.fn(async () => undefined);
  const hook = await renderHook(() => useChangePassword({ change, refreshSession }), { wrapper });
  return { ...hook, change, refreshSession };
}

type Form = ReturnType<typeof useChangePassword>;

async function fillIn(form: Form, current: string, next: string, confirm = next) {
  await act(async () => {
    form.setCurrent(current);
    form.setNext(next);
    form.setConfirm(confirm);
  });
}

async function submit(result: { current: Form }) {
  await act(async () => {
    await result.current.submit();
  });
}

describe("useChangePassword", () => {
  it("sends both passwords with revokeOtherSessions, then refreshes this phone's session", async () => {
    const { result, change, refreshSession } = await renderForm();

    await fillIn(result.current, "old password", "new password");
    await submit(result);

    expect(change).toHaveBeenCalledWith({
      currentPassword: "old password",
      newPassword: "new password",
      revokeOtherSessions: true,
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.changed).toBe(true);
    expect(result.current.errors).toEqual({});
    expect([result.current.current, result.current.next, result.current.confirm]).toEqual([
      "",
      "",
      "",
    ]);
  });

  it("returns canSubmit false until all three fields are filled in", async () => {
    const { result } = await renderForm();

    expect(result.current.canSubmit).toBe(false);
    await act(async () => {
      result.current.setCurrent("old password");
      result.current.setNext("new password");
    });
    expect(result.current.canSubmit).toBe(false);
    await act(async () => result.current.setConfirm("new password"));
    expect(result.current.canSubmit).toBe(true);
  });

  it("shows a mismatched confirmation under the confirm field without asking the server", async () => {
    const { result, change } = await renderForm();

    await fillIn(result.current, "old password", "new password", "new passwort");
    await submit(result);

    expect(change).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({ confirm: errors.mismatch });
  });

  it("shows a short new password under the new-password field without asking the server", async () => {
    const { result, change } = await renderForm();

    await fillIn(result.current, "old password", "short");
    await submit(result);

    expect(change).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({ next: errors.tooShort });
  });

  it("shows a wrong current password under the current field and keeps the session as it is", async () => {
    const { result, refreshSession } = await renderForm({
      error: { status: 400, code: "INVALID_PASSWORD", message: "Invalid password" },
    });

    await fillIn(result.current, "not it", "new password");
    await submit(result);

    expect(result.current.errors).toEqual({ current: errors.wrongCurrent });
    expect(result.current.changed).toBe(false);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("shows a breached new password under the new-password field", async () => {
    const { result } = await renderForm({
      error: { status: 400, code: "PASSWORD_COMPROMISED", message: "compromised" },
    });

    await fillIn(result.current, "old password", "password1");
    await submit(result);

    expect(result.current.errors).toEqual({ next: errors.compromised });
  });

  it("shows the server's message for any other refusal", async () => {
    const { result } = await renderForm({
      error: { status: 400, code: "CREDENTIAL_ACCOUNT_NOT_FOUND", message: "Credential not found" },
    });

    await fillIn(result.current, "old password", "new password");
    await submit(result);

    expect(result.current.errors).toEqual({ form: "Credential not found" });
  });

  it("reads the session back after a 5xx too, since the password may have changed before it", async () => {
    const { result, refreshSession } = await renderForm({
      error: { status: 500, message: "Failed to get session" },
    });

    await fillIn(result.current, "old password", "new password");
    await submit(result);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.errors).toEqual({ form: "Failed to get session" });
    expect(result.current.changed).toBe(false);
  });

  it("falls back to its own message when the refusal carries none", async () => {
    const { result } = await renderForm({ error: { status: 500 } });

    await fillIn(result.current, "old password", "new password");
    await submit(result);

    expect(result.current.errors).toEqual({ form: errors.failed });
  });

  it("says the server cannot be reached when the request never arrives", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = await renderForm(new TypeError("Network request failed"));

    await fillIn(result.current, "old password", "new password");
    await submit(result);

    expect(result.current.errors).toEqual({ form: en.sync.unreachable });
    expect(result.current.loading).toBe(false);
  });

  it("hands a 401 to the session lookup, which signs a phone without a session out", async () => {
    const { result, refreshSession } = await renderForm({
      error: { status: 401, code: "UNAUTHORIZED", message: "Unauthorized" },
    });

    await fillIn(result.current, "old password", "new password");
    await submit(result);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(result.current.changed).toBe(false);
  });

  it("clears a field's error as soon as that field changes", async () => {
    const { result } = await renderForm({
      error: { status: 400, code: "INVALID_PASSWORD", message: "Invalid password" },
    });

    await fillIn(result.current, "not it", "new password");
    await submit(result);
    await act(async () => result.current.setCurrent("old password"));

    expect(result.current.errors).toEqual({});
  });

  it("clears a mismatch under the confirm field once the new password changes", async () => {
    const { result } = await renderForm();

    await fillIn(result.current, "old password", "new password", "new passwort");
    await submit(result);
    await act(async () => result.current.setNext("new passwort"));

    expect(result.current.errors).toEqual({});
  });
});

describe("useRefreshSession", () => {
  async function renderRefresh() {
    const { result } = await renderHook(() => useRefreshSession());
    await act(async () => {
      await result.current();
    });
  }

  it("reads the session back through the auth client and leaves a live one alone", async () => {
    getSession.mockResolvedValue({ data: { session: { id: "new" } }, error: null });

    await renderRefresh();

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(mockWipe).not.toHaveBeenCalled();
  });

  it("wipes the phone once when the lookup answers 401", async () => {
    getSession.mockResolvedValue({ data: null, error: { status: 401 } });

    await renderRefresh();

    expect(mockWipe).toHaveBeenCalledTimes(1);
  });
});
