import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { toast } from "sonner-native";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  approveVacations,
  cancelVacations,
  pull,
  rejectVacations,
  updateVacation,
} from "@/lib/local-store";
import { ApiError } from "@/lib/query/failure";
import { queryClient } from "@/lib/query/runtime";
import { useVacationActions } from "@/lib/query/vacation-actions";
import { useCommentVacation, useVacationDetail } from "@/lib/query/vacation-detail";
import { vacationDetail } from "@/test-support/vacation-detail";

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
  cancelVacations: jest.fn(),
  updateVacation: jest.fn(),
}));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const toastError = toast.error as unknown as jest.Mock<
  void,
  [string, { action: { label: string; onClick: () => void } }?]
>;

// A finished mutation waits five minutes to be collected, and that timer keeps Jest running.
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

function reads(pathEnd: string) {
  return mockFetch.mock.calls.filter(
    ([url, init]) => String(url).endsWith(pathEnd) && (init?.method ?? "GET") === "GET"
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockImplementation(async (url: string) =>
    String(url).includes("/approvals") ? answer(200, []) : answer(200, vacationDetail())
  );
});

afterEach(() => queryClient.clear());

describe("useVacationDetail", () => {
  it("returns the detail from /api/vacation/:id", async () => {
    const { result } = await renderHook(() => useVacationDetail("vacation-1"), { wrapper });

    await waitFor(() => expect(result.current.data?.id).toBe("vacation-1"));
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/vacation\/vacation-1$/);
  });

  it("reads the server again on every open, keeping nothing from the last", async () => {
    const first = await renderHook(() => useVacationDetail("vacation-1"), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await first.unmount();
    // Nothing is kept: the cache lets the answer go once the screen does.
    await waitFor(() =>
      expect(
        queryClient.getQueryCache().find({ queryKey: ["vacation", "vacation-1"] })
      ).toBeUndefined()
    );

    const second = await renderHook(() => useVacationDetail("vacation-1"), { wrapper });

    expect(second.result.current.data).toBeUndefined();
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(reads("/api/vacation/vacation-1")).toHaveLength(2);
  });

  it("returns a 404 as an ApiError, without retrying", async () => {
    mockFetch.mockResolvedValue(answer(404, { errors: [{ message: "Vacation not found" }] }));

    const { result } = await renderHook(() => useVacationDetail("gone"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("useCommentVacation", () => {
  it("posts the message and reads the detail again", async () => {
    const detail = await renderHook(() => useVacationDetail("vacation-1"), { wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    const { result } = await renderHook(() => useCommentVacation("vacation-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("Enjoy the trip");
    });

    const post = mockFetch.mock.calls.find(([, init]) => init?.method === "POST");
    expect(String(post?.[0])).toMatch(/\/api\/vacation\/comment\/vacation-1$/);
    expect(JSON.parse(String(post?.[1].body))).toEqual({ message: "Enjoy the trip" });
    await waitFor(() => expect(reads("/api/vacation/vacation-1")).toHaveLength(2));
  });

  it("toasts a Retry that sends the same message when no answer arrives", async () => {
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new TypeError("Network request failed");
      return answer(200, vacationDetail());
    });
    const { result } = await renderHook(() => useCommentVacation("vacation-1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("Enjoy the trip").catch(() => undefined);
    });

    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable, {
      action: { label: en.request.retry, onClick: expect.any(Function) },
    });
    await act(async () => toastError.mock.calls[0][1]!.action.onClick());
    const posts = mockFetch.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(2);
    expect(JSON.parse(String(posts[1][1].body))).toEqual({ message: "Enjoy the trip" });
  });
});

describe("useVacationActions", () => {
  const approve = approveVacations as jest.MockedFunction<typeof approveVacations>;
  const reject = rejectVacations as jest.MockedFunction<typeof rejectVacations>;
  const cancel = cancelVacations as jest.MockedFunction<typeof cancelVacations>;
  const update = updateVacation as jest.MockedFunction<typeof updateVacation>;

  async function renderOpenDetail() {
    const detail = await renderHook(() => useVacationDetail("vacation-1"), { wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    const approvals = await renderHook(
      () => useQuery({ queryKey: ["my-approvals"], queryFn: () => [] }),
      { wrapper }
    );
    await waitFor(() => expect(approvals.result.current.isSuccess).toBe(true));
    return renderHook(() => useVacationActions("vacation-1"), { wrapper });
  }

  it("approves every day of the run through the store and reads the detail again", async () => {
    approve.mockResolvedValue({ ok: true });
    const { result } = await renderOpenDetail();

    let taken!: boolean;
    await act(async () => {
      taken = await result.current.approve(["vacation-1", "vacation-2"]);
    });

    expect(taken).toBe(true);
    expect(approve).toHaveBeenCalledWith(["vacation-1", "vacation-2"]);
    expect(reads("/api/vacation/vacation-1")).toHaveLength(2);
    expect(queryClient.getQueryState(["my-approvals"])?.dataUpdateCount).toBe(2);
  });

  it("passes the reason a decline or a cancellation was given", async () => {
    reject.mockResolvedValue({ ok: true });
    cancel.mockResolvedValue({ ok: true });
    const { result } = await renderOpenDetail();

    await act(async () => {
      await result.current.reject(["vacation-1"], "Too many away");
      await result.current.cancel(["vacation-1"], undefined);
    });

    expect(reject).toHaveBeenCalledWith(["vacation-1"], "Too many away");
    expect(cancel).toHaveBeenCalledWith(["vacation-1"], undefined);
  });

  it("edits through the store's updateVacation", async () => {
    update.mockResolvedValue({ ok: true });
    const { result } = await renderOpenDetail();

    await act(async () => {
      await result.current.update({ ids: ["vacation-1"], note: "From home" });
    });

    expect(update).toHaveBeenCalledWith({ ids: ["vacation-1"], note: "From home" });
  });

  it("toasts the server's message, reads the detail again and pulls on a refusal", async () => {
    approve.mockResolvedValue({
      ok: false,
      reason: "rejected",
      status: 403,
      message: "You cannot approve your own request",
    });
    const { result } = await renderOpenDetail();

    let taken!: boolean;
    await act(async () => {
      taken = await result.current.approve(["vacation-1"]);
    });

    expect(taken).toBe(false);
    expect(toastError).toHaveBeenCalledWith("You cannot approve your own request");
    expect(pull).toHaveBeenCalledWith("refresh");
    await waitFor(() => expect(reads("/api/vacation/vacation-1")).toHaveLength(2));
  });

  it("toasts a Retry that sends the same decision when no answer arrives", async () => {
    reject.mockResolvedValue({ ok: false, reason: "unreachable", message: null });
    const { result } = await renderOpenDetail();

    await act(async () => {
      await result.current.reject(["vacation-1"], "Too many away");
    });
    reject.mockResolvedValue({ ok: true });
    await act(async () => toastError.mock.calls[0][1]!.action.onClick());

    expect(reject.mock.calls).toEqual([
      [["vacation-1"], "Too many away"],
      [["vacation-1"], "Too many away"],
    ]);
  });

  it("says which action is running while it runs", async () => {
    let settle: (outcome: { ok: true }) => void = () => {};
    cancel.mockImplementation(() => new Promise((resolve) => (settle = resolve)));
    const { result } = await renderOpenDetail();

    let written!: Promise<boolean>;
    await act(async () => {
      written = result.current.cancel(["vacation-1"]);
    });
    expect(result.current.running).toBe("cancel");

    await act(async () => {
      settle({ ok: true });
      await written;
    });
    expect(result.current.running).toBeNull();
  });
});
