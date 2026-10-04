import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { toast } from "sonner-native";

import { TranslationProvider } from "@/i18n/use-translation";
import { createVacation, pull, type CreateOutcome, type VacationDraft } from "@/lib/local-store";
import { useCreateRequest } from "@/lib/query/create-request";
import { queryClient } from "@/lib/query/runtime";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({
  pull: jest.fn().mockResolvedValue({ ok: true }),
  createVacation: jest.fn(),
}));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const create = createVacation as jest.MockedFunction<typeof createVacation>;

const DRAFT: VacationDraft = { groupId: "group-1", from: "2026-10-05", to: "2026-10-06" };

function answer(status: number, body: unknown) {
  return { status, json: async () => body };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TranslationProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(answer(200, []));
});

afterEach(() => queryClient.clear());

async function renderWithApprovals() {
  const approvals = await renderHook(
    () => useQuery({ queryKey: ["my-approvals"], queryFn: () => [] }),
    { wrapper }
  );
  await waitFor(() => expect(approvals.result.current.isSuccess).toBe(true));
  return renderHook(() => useCreateRequest(), { wrapper });
}

describe("useCreateRequest", () => {
  it("returns the booking the server made and reads the approvals again", async () => {
    create.mockResolvedValue({
      ok: true,
      created: { requestId: "request-1", vacationId: "vacation-1" },
    });
    const { result } = await renderWithApprovals();

    let outcome!: CreateOutcome;
    await act(async () => {
      outcome = await result.current.submit(DRAFT);
    });

    expect(create).toHaveBeenCalledWith(DRAFT);
    expect(outcome).toEqual({
      ok: true,
      created: { requestId: "request-1", vacationId: "vacation-1" },
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(["my-approvals"])?.dataUpdateCount).toBe(2)
    );
  });

  it("says it is submitting until the server answers", async () => {
    let settle: (outcome: CreateOutcome) => void = () => {};
    create.mockImplementation(() => new Promise((resolve) => (settle = resolve)));
    const { result } = await renderWithApprovals();

    let written!: Promise<CreateOutcome>;
    await act(async () => {
      written = result.current.submit(DRAFT);
    });
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      settle({ ok: true });
      await written;
    });
    expect(result.current.submitting).toBe(false);
  });

  it("returns a refusal for the form to show, pulls, and toasts nothing", async () => {
    create.mockResolvedValue({
      ok: false,
      reason: "rejected",
      status: 409,
      message: "Already booked",
      context: { conflictingDays: ["2026-10-05"] },
    });
    const { result } = await renderWithApprovals();

    let outcome!: CreateOutcome;
    await act(async () => {
      outcome = await result.current.submit(DRAFT);
    });

    expect(outcome).toMatchObject({ ok: false, status: 409 });
    expect(pull).toHaveBeenCalledWith("refresh");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("returns an unreachable server as it is, pulling nothing", async () => {
    create.mockResolvedValue({ ok: false, reason: "unreachable", message: null });
    const { result } = await renderWithApprovals();

    let outcome!: CreateOutcome;
    await act(async () => {
      outcome = await result.current.submit(DRAFT);
    });

    expect(outcome).toEqual({ ok: false, reason: "unreachable", message: null });
    expect(pull).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
