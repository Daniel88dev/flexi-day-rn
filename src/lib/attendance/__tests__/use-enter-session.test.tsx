import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";

import { apiRequest, rereadAfterSelfService } from "@/lib/query";
import { ApiError } from "@/lib/query/failure";
import { session } from "@/test-support/attendance";

import { useEnterSession, type AttendanceEntry } from "../use-enter-session";

jest.mock("@/lib/query", () => ({
  apiRequest: jest.fn(),
  rereadAfterSelfService: jest.fn(),
}));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const request = jest.mocked(apiRequest);
const reread = jest.mocked(rereadAfterSelfService);

const ENTRY: AttendanceEntry = {
  organizationId: "org-1",
  businessDate: "2026-09-24",
  startedAt: "2026-09-24T11:00:00.000Z",
  endedAt: "2026-09-24T15:00:00.000Z",
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

async function saveOnce() {
  const hook = await renderHook(() => useEnterSession(), { wrapper });
  let saved: unknown;
  await act(async () => {
    saved = await hook.result.current.save(ENTRY);
  });
  return { saved, result: hook.result };
}

beforeEach(() => {
  jest.clearAllMocks();
  reread.mockResolvedValue({ arrived: true });
});

describe("useEnterSession", () => {
  it("posts the entry, reads attendance again and returns the saved session", async () => {
    const entered = session({ id: "entered", businessDate: "2026-09-24" });
    request.mockResolvedValue(entered);

    const { saved, result } = await saveOnce();

    expect(request).toHaveBeenCalledWith("/api/attendance/sessions", {
      method: "POST",
      body: ENTRY,
    });
    expect(reread).toHaveBeenCalledTimes(1);
    expect(saved).toBe(entered);
    expect(result.current.failure).toBeNull();
    expect(result.current.saving).toBe(false);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("returns nothing on a refusal, keeps it for the sheet, and still reads again", async () => {
    request.mockRejectedValue(new ApiError(409, "Overlap", { reason: "SESSION_OVERLAPS" }));

    const { saved, result } = await saveOnce();

    expect(saved).toBeNull();
    expect(reread).toHaveBeenCalledTimes(1);
    expect(result.current.failure).toMatchObject({ kind: "refused", reason: "SESSION_OVERLAPS" });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");
  });

  it("returns a network failure, which the sheet turns into Retry, when no answer came", async () => {
    request.mockRejectedValue(new TypeError("Network request failed"));

    const { saved, result } = await saveOnce();

    expect(saved).toBeNull();
    expect(reread).toHaveBeenCalledTimes(1);
    expect(result.current.failure).toEqual({ kind: "network" });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
  });

  it("leaves a 401 to the signed-out wipe, with no failure and no haptic", async () => {
    request.mockRejectedValue(new ApiError(401, null));

    const { result } = await saveOnce();

    expect(result.current.failure).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
