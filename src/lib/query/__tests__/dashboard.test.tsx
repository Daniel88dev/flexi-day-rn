import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { toast } from "sonner-native";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { approveVacations, pull, rejectVacations } from "@/lib/local-store";
import {
  useApprovalDecisions,
  useDashboardSummary,
  useMyApprovals,
  useRereadDashboard,
  useRereadDashboardOnFocus,
  type PendingApproval,
} from "@/lib/query/dashboard";
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
  approveVacations: jest.fn(),
  rejectVacations: jest.fn(),
}));
let mockFocus: () => void = () => undefined;
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
}));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const SUMMARY = {
  pendingApprovalsCount: 2,
  outTodayCount: 3,
  workingTodayCount: 5,
  upcomingNext14DaysCount: 4,
  teamSize: 8,
};

const APPROVAL: PendingApproval = {
  vacationIds: ["vacation-1", "vacation-2"],
  user: { id: "user-2", name: "Eva Horáková", initials: "EH", avatarColor: "hsl(20 60% 50%)" },
  groupId: "group-1",
  groupName: "Engineering",
  vacationType: "VACATION",
  from: "2026-10-05",
  to: "2026-10-06",
  businessDays: 2,
  note: null,
  submittedAt: "2026-09-20T08:00:00.000Z",
};

const approve = approveVacations as jest.MockedFunction<typeof approveVacations>;
const reject = rejectVacations as jest.MockedFunction<typeof rejectVacations>;
const syncPull = pull as jest.MockedFunction<typeof pull>;
const toastError = toast.error as unknown as jest.Mock<
  void,
  [string, { action: { label: string; onClick: () => void } }?]
>;

// A finished mutation or query waits minutes to be collected, and that timer keeps Jest running.
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TranslationProvider>
  );
}

const READY = { state: "ready", summary: SUMMARY };
const FAILED = { state: "failed" };

const offline = () => mockFetch.mockRejectedValue(new TypeError("Network request failed"));

/** A read without an answer gets one retry, a second later, before it settles as failed. */
const RETRY_SETTLED = { timeout: 3_000 };

function reads(pathEnd: string) {
  return mockFetch.mock.calls.filter(([url]) => String(url).endsWith(pathEnd));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockImplementation(async (url: string) =>
    String(url).endsWith("/approvals") ? answer(200, [APPROVAL]) : answer(200, SUMMARY)
  );
  approve.mockResolvedValue({ ok: true });
  reject.mockResolvedValue({ ok: true });
  syncPull.mockResolvedValue({ ok: true });
});

afterEach(() => queryClient.clear());

describe("useDashboardSummary", () => {
  it("returns the counts /api/users/me/dashboard-summary answers, ready", async () => {
    const { result } = await renderHook(() => useDashboardSummary(), { wrapper });

    await waitFor(() => expect(result.current).toEqual(READY));
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/users\/me\/dashboard-summary$/);
  });

  it("returns loading until the server answers", async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));

    const { result } = await renderHook(() => useDashboardSummary(), { wrapper });

    expect(result.current).toEqual({ state: "loading" });
  });

  it("returns failed when the server can't be reached", async () => {
    offline();

    const { result } = await renderHook(() => useDashboardSummary(), { wrapper });

    await waitFor(() => expect(result.current).toEqual(FAILED), RETRY_SETTLED);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns failed once a later read fails, not the counts it read before", async () => {
    const { result } = await renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(result.current).toEqual(READY));
    offline();

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["dashboard-summary"] });
    });

    await waitFor(() => expect(result.current).toEqual(FAILED), RETRY_SETTLED);
  });

  it("returns the counts again once the server answers after a failure", async () => {
    offline();
    const { result } = await renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(result.current).toEqual(FAILED), RETRY_SETTLED);
    mockFetch.mockResolvedValue(answer(200, SUMMARY));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["dashboard-summary"] });
    });

    await waitFor(() => expect(result.current).toEqual(READY));
  });
});

describe("useMyApprovals", () => {
  it("returns what /api/users/me/approvals answers", async () => {
    const { result } = await renderHook(() => useMyApprovals(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([APPROVAL]));
    expect(reads("/api/users/me/approvals")).toHaveLength(1);
  });
});

describe("useApprovalDecisions", () => {
  /** The card's reads are on screen, as they are while its buttons can be tapped. */
  async function onScreen() {
    const approvals = await renderHook(() => useMyApprovals(), { wrapper });
    const summary = await renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(approvals.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(summary.result.current).toEqual(READY));
    const { result } = await renderHook(() => useApprovalDecisions(), { wrapper });
    return result;
  }

  it("approves every day of the item through the store, then reads approvals and summary again", async () => {
    const decisions = await onScreen();

    let taken = false;
    await act(async () => {
      taken = await decisions.current.approve(APPROVAL);
    });

    expect(taken).toBe(true);
    expect(approve).toHaveBeenCalledWith(["vacation-1", "vacation-2"]);
    await waitFor(() => expect(reads("/api/users/me/approvals")).toHaveLength(2));
    await waitFor(() => expect(reads("/api/users/me/dashboard-summary")).toHaveLength(2));
  });

  it("declines every day of the item with the reason given", async () => {
    const decisions = await onScreen();

    await act(async () => {
      await decisions.current.decline(APPROVAL, "Release week");
    });

    expect(reject).toHaveBeenCalledWith(["vacation-1", "vacation-2"], "Release week");
    await waitFor(() => expect(reads("/api/users/me/approvals")).toHaveLength(2));
    await waitFor(() => expect(reads("/api/users/me/dashboard-summary")).toHaveLength(2));
  });

  it("returns the item being decided while its write is in flight", async () => {
    let settle: () => void = () => undefined;
    approve.mockReturnValue(
      new Promise((resolve) => {
        settle = () => resolve({ ok: true });
      })
    );
    const decisions = await onScreen();

    let decided: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      decided = decisions.current.approve(APPROVAL);
    });
    expect(decisions.current.deciding).toEqual({ id: "vacation-1", decision: "approve" });

    await act(async () => {
      settle();
      await decided;
    });
    expect(decisions.current.deciding).toBeNull();
  });

  it("answers a refusal with the server's message, fresh reads and a sync pull", async () => {
    approve.mockResolvedValue({
      ok: false,
      reason: "rejected",
      status: 409,
      message: "Someone else decided this request.",
    });
    const decisions = await onScreen();

    let taken = true;
    await act(async () => {
      taken = await decisions.current.approve(APPROVAL);
    });

    expect(taken).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Someone else decided this request.");
    expect(syncPull).toHaveBeenCalledWith("refresh");
    await waitFor(() => expect(reads("/api/users/me/approvals")).toHaveLength(2));
    await waitFor(() => expect(reads("/api/users/me/dashboard-summary")).toHaveLength(2));
  });

  it("offers a Retry that decides the same item again when no answer arrives", async () => {
    approve.mockResolvedValueOnce({ ok: false, reason: "unreachable", message: null });
    const decisions = await onScreen();

    await act(async () => {
      await decisions.current.approve(APPROVAL);
    });

    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable, {
      action: { label: en.request.retry, onClick: expect.any(Function) },
    });
    await act(async () => toastError.mock.calls[0][1]?.action.onClick());
    expect(approve).toHaveBeenLastCalledWith(["vacation-1", "vacation-2"]);
    expect(approve).toHaveBeenCalledTimes(2);
  });

  it("returns the item and its decision as being decided while a Retry's write is in flight", async () => {
    let settle: () => void = () => undefined;
    reject
      .mockResolvedValueOnce({ ok: false, reason: "unreachable", message: null })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          settle = () => resolve({ ok: true });
        })
      );
    const decisions = await onScreen();
    await act(async () => {
      await decisions.current.decline(APPROVAL, "Release week");
    });
    expect(decisions.current.deciding).toBeNull();

    await act(async () => toastError.mock.calls[0][1]?.action.onClick());

    expect(reject).toHaveBeenLastCalledWith(["vacation-1", "vacation-2"], "Release week");
    expect(decisions.current.deciding).toEqual({ id: "vacation-1", decision: "decline" });
    await act(async () => settle());
    await waitFor(() => expect(decisions.current.deciding).toBeNull());
  });
});

describe("useRereadDashboardOnFocus", () => {
  it("reads the summary and the approvals again when the dashboard comes back into focus", async () => {
    const approvals = await renderHook(() => useMyApprovals(), { wrapper });
    const summary = await renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(approvals.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(summary.result.current).toEqual(READY));
    await renderHook(() => useRereadDashboardOnFocus(), { wrapper });

    await act(async () => mockFocus());
    await act(async () => mockFocus());

    await waitFor(() => expect(reads("/api/users/me/approvals")).toHaveLength(2));
    await waitFor(() => expect(reads("/api/users/me/dashboard-summary")).toHaveLength(2));
  });
});

describe("useRereadDashboard", () => {
  it("returns a reread of the summary and the approvals, for pull-to-refresh", async () => {
    const approvals = await renderHook(() => useMyApprovals(), { wrapper });
    const summary = await renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(approvals.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(summary.result.current).toEqual(READY));
    const { result } = await renderHook(() => useRereadDashboard(), { wrapper });

    await act(async () => result.current());

    await waitFor(() => expect(reads("/api/users/me/approvals")).toHaveLength(2));
    await waitFor(() => expect(reads("/api/users/me/dashboard-summary")).toHaveLength(2));
  });
});
