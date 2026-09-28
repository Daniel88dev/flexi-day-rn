import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";

import { apiRequest, rereadAfterSelfService } from "@/lib/query";
import { ApiError } from "@/lib/query/failure";
import { session } from "@/test-support/attendance";

import type { CorrectionStep } from "../correction-sheet";
import { useCorrectSession } from "../use-correct-session";

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

const SPAN = { startedAt: "2026-09-24T13:00:00.000Z", endedAt: "2026-09-24T13:10:00.000Z" };
const STEPS: CorrectionStep[] = [
  { kind: "delete-break", breakId: "coffee" },
  { kind: "patch-session", sessionId: "s1", patch: { endedAt: "2026-09-24T15:00:00.000Z" } },
  { kind: "patch-break", breakId: "lunch", patch: { startedAt: "2026-09-24T10:15:00.000Z" } },
  { kind: "add-break", sessionId: "s1", draftId: "new-1", span: SPAN },
];

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const sent = () => request.mock.calls.map(([path, options]) => [options?.method, path]);

beforeEach(() => {
  jest.clearAllMocks();
  reread.mockResolvedValue({ arrived: true });
});

describe("useCorrectSession", () => {
  it("sends each step to its endpoint in order, then reads attendance again", async () => {
    request.mockResolvedValue(session({ id: "s1" }));
    const { result } = await renderHook(() => useCorrectSession(), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.save>> | undefined;
    await act(async () => {
      outcome = await result.current.save(STEPS);
    });

    expect(sent()).toEqual([
      ["DELETE", "/api/attendance/breaks/coffee"],
      ["PATCH", "/api/attendance/sessions/s1"],
      ["PATCH", "/api/attendance/breaks/lunch"],
      ["POST", "/api/attendance/sessions/s1/breaks"],
    ]);
    expect(request.mock.calls[3]?.[1]?.body).toEqual(SPAN);
    expect(outcome?.saved).toBe(true);
    expect(outcome?.landed).toHaveLength(4);
    expect(reread).toHaveBeenCalledTimes(1);
    expect(result.current.failure).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("stops at a refusal, keeps it for the sheet, and still reads attendance again", async () => {
    request
      .mockResolvedValueOnce(session({ id: "s1" }))
      .mockRejectedValueOnce(new ApiError(409, "Overlap", { reason: "SESSION_OVERLAPS" }));
    const { result } = await renderHook(() => useCorrectSession(), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.save>> | undefined;
    await act(async () => {
      outcome = await result.current.save(STEPS);
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(outcome?.saved).toBe(false);
    expect(outcome?.landed.map((entry) => entry.step.kind)).toEqual(["delete-break"]);
    expect(reread).toHaveBeenCalledTimes(1);
    expect(result.current.failure).toMatchObject({ kind: "refused", reason: "SESSION_OVERLAPS" });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");
  });

  it("reports no answer as a network failure", async () => {
    request.mockRejectedValue(new TypeError("Network request failed"));
    const { result } = await renderHook(() => useCorrectSession(), { wrapper });

    await act(async () => {
      await result.current.save(STEPS);
    });

    expect(result.current.failure).toEqual({ kind: "network" });
    expect(reread).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
  });

  it("deletes the session and reads attendance again", async () => {
    request.mockResolvedValue(session({ id: "s1" }));
    const { result } = await renderHook(() => useCorrectSession(), { wrapper });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.remove("s1");
    });

    expect(sent()).toEqual([["DELETE", "/api/attendance/sessions/s1"]]);
    expect(deleted).toBe(true);
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it("keeps a refused delete for the sheet", async () => {
    request.mockRejectedValue(new ApiError(403, "No", { reason: "SELF_SERVICE_DELETE" }));
    const { result } = await renderHook(() => useCorrectSession(), { wrapper });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.remove("s1");
    });

    expect(deleted).toBe(false);
    expect(result.current.failure).toMatchObject({ reason: "SELF_SERVICE_DELETE" });
    expect(reread).toHaveBeenCalledTimes(1);
  });
});
