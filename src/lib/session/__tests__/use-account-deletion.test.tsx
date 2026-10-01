import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { apiRequest } from "@/lib/query";
import { ApiError } from "@/lib/query/failure";
import type { DeletionStatus } from "@/lib/session/account-deletion";
import { clearSignedOutNotice, signedOutNotice } from "@/lib/session/signed-out-notice";
import { useAccountDeletion } from "@/lib/session/use-account-deletion";

jest.mock("@/lib/query", () => ({
  apiRequest: jest.fn(),
  qk: jest.requireActual("@/lib/query/keys").qk,
}));
jest.mock("@/lib/session/signed-out-wipe", () => ({ useSignedOutWipe: jest.fn() }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const request = jest.mocked(apiRequest);
const copy = en.settings.deleteAccount;

const DELETABLE: DeletionStatus = { canDelete: true, blockers: [], confirmation: "password" };
const GROUP_BLOCKER = {
  kind: "GROUP_HAS_MEMBERS",
  groupId: "6f1c0a52-1b7e-4c38-9a0e-2d5f8c3b4a71",
  groupName: "Design",
  otherMembers: 2,
} as const;

let statusAnswers: (DeletionStatus | Error)[];
let deleteAnswer: undefined | Error;

beforeEach(() => {
  jest.clearAllMocks();
  clearSignedOutNotice();
  statusAnswers = [DELETABLE];
  deleteAnswer = undefined;
  request.mockImplementation(async (path: string) => {
    if (path === "/api/users/me/deletion") {
      const next = statusAnswers.length > 1 ? statusAnswers.shift() : statusAnswers[0];
      if (next instanceof Error) throw next;
      return next;
    }
    if (deleteAnswer) throw deleteAnswer;
    return undefined;
  });
});

async function renderDeletion() {
  // An infinite gcTime sets no collection timer, which would keep Jest running.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wipe = jest.fn(async () => undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TranslationProvider>{children}</TranslationProvider>
    </QueryClientProvider>
  );
  const hook = await renderHook(() => useAccountDeletion({ wipe }), { wrapper });
  return { ...hook, wipe, client };
}

async function deleteWith(
  result: { current: ReturnType<typeof useAccountDeletion> },
  password: string
) {
  await act(async () => result.current.setPassword(password));
  await act(async () => {
    await result.current.remove();
  });
}

describe("useAccountDeletion", () => {
  it("reads the deletion check and offers the password prompt", async () => {
    const { result } = await renderDeletion();

    await waitFor(() => expect(result.current.view).toEqual({ kind: "password" }));
    expect(request).toHaveBeenCalledWith("/api/users/me/deletion", expect.anything());
  });

  it("returns unreachable when the check gets no answer, and reads it again on retry", async () => {
    statusAnswers = [new TypeError("Network request failed"), DELETABLE];
    const { result } = await renderDeletion();

    await waitFor(() => expect(result.current.view).toEqual({ kind: "unreachable" }));
    await act(async () => {
      await result.current.reread();
    });

    await waitFor(() => expect(result.current.view).toEqual({ kind: "password" }));
  });

  it("sends the password, then wipes the phone without signing out", async () => {
    const { result, wipe } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));

    await deleteWith(result, "hunter22");

    expect(request).toHaveBeenCalledWith("/api/users/me/delete", {
      method: "POST",
      body: { password: "hunter22" },
    });
    expect(wipe).toHaveBeenCalledTimes(1);
    expect(signedOutNotice()).toBe("account-deleted");
  });

  it("shows the account's own failure wording for a 5xx, with Retry", async () => {
    deleteAnswer = new ApiError(500, "Internal Server Error");
    const { result } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));

    await deleteWith(result, "hunter22");

    expect(result.current.error).toBe(copy.failed);
    expect(result.current.retry).toBe(true);
  });

  it("sends nothing without a password", async () => {
    const { result } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));

    await deleteWith(result, "");

    expect(request).not.toHaveBeenCalledWith("/api/users/me/delete", expect.anything());
    expect(result.current.canDelete).toBe(false);
  });

  it("returns a wrong password on the field and keeps the phone signed in", async () => {
    deleteAnswer = new ApiError(403, "The password is not correct", {
      reason: "PASSWORD_INVALID",
    });
    const { result, wipe } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));

    await deleteWith(result, "wrong");

    expect(result.current.passwordError).toBe(copy.wrongPassword);
    expect(wipe).not.toHaveBeenCalled();
    await act(async () => result.current.setPassword("wrong2"));
    expect(result.current.passwordError).toBeNull();
  });

  it("shows the 409's blockers and reads the check again", async () => {
    deleteAnswer = new ApiError(409, "Blocked", {
      reason: "DELETION_BLOCKED",
      blockers: [GROUP_BLOCKER],
    });
    const { result, wipe } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));
    statusAnswers = [{ canDelete: false, blockers: [GROUP_BLOCKER], confirmation: "password" }];
    const readsBefore = request.mock.calls.filter(([path]) => path.endsWith("/deletion")).length;

    await deleteWith(result, "hunter22");

    expect(result.current.view).toEqual({ kind: "blocked", blockers: [GROUP_BLOCKER] });
    await waitFor(() =>
      expect(request.mock.calls.filter(([path]) => path.endsWith("/deletion")).length).toBe(
        readsBefore + 1
      )
    );
    expect(wipe).not.toHaveBeenCalled();
  });

  it("hands over to the web when the server asks for a fresh sign-in", async () => {
    deleteAnswer = new ApiError(403, "Sign in again", { reason: "REAUTH_REQUIRED" });
    const { result } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));
    statusAnswers = [{ ...DELETABLE, confirmation: "recent-sign-in" }];

    await deleteWith(result, "hunter22");

    expect(result.current.view).toEqual({ kind: "web" });
  });

  it("turns Delete into Retry when no answer came, and deletes on the retry", async () => {
    deleteAnswer = new TypeError("Network request failed");
    const { result, wipe } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));

    await deleteWith(result, "hunter22");

    expect(result.current.retry).toBe(true);
    expect(result.current.error).toBe(en.sync.unreachable);
    deleteAnswer = undefined;
    await act(async () => {
      await result.current.remove();
    });
    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it("shows the server's words for any other refusal, without Retry", async () => {
    deleteAnswer = new ApiError(429, "Too many requests");
    const { result } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));

    await deleteWith(result, "hunter22");

    expect(result.current.error).toBe("Too many requests");
    expect(result.current.retry).toBe(false);
  });

  it("says nothing of a 401, which the signed-out wipe answers", async () => {
    deleteAnswer = new ApiError(401, "Unauthorized");
    const { result, wipe } = await renderDeletion();
    await waitFor(() => expect(result.current.view.kind).toBe("password"));

    await deleteWith(result, "hunter22");

    expect(result.current.error).toBeNull();
    expect(result.current.passwordError).toBeNull();
    expect(wipe).not.toHaveBeenCalled();
  });
});
