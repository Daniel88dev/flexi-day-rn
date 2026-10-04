import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { ReportFilters } from "@/lib/report";
import {
  useMemberReport,
  useReportOverview,
  useReportScope,
  useRereadReportOnFocus,
} from "@/lib/query/report";
import { queryClient } from "@/lib/query/runtime";
import { memberReport, reportOverview, reportScope } from "@/test-support/report";

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
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
let mockFocus: () => void = () => undefined;
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
}));

const reply = (status: number, body: unknown) => ({ status, json: async () => body });

/** The backend's three reads, the overview answering for whatever year was asked. */
function answer() {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/api/reports/scope")) return reply(200, reportScope());
    if (url.includes("/api/reports/overview")) {
      const year = Number(new URL(url).searchParams.get("year"));
      return reply(200, reportOverview({ year }));
    }
    if (url.includes("/api/reports/members/")) {
      const year = Number(new URL(url).searchParams.get("year"));
      return reply(200, memberReport({ year }));
    }
    return reply(404, {});
  });
}

const urlsOf = (path: string) =>
  mockFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(path));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  answer();
});

afterEach(() => queryClient.clear());

describe("useReportScope", () => {
  it("returns the scope from /api/reports/scope under the web's key", async () => {
    const { result } = await renderHook(useReportScope, { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(reportScope()));
    expect(urlsOf("/api/reports/scope")).toEqual([expect.stringMatching(/\/api\/reports\/scope$/)]);
    expect(queryClient.getQueryData(["report-scope"])).toEqual(reportScope());
  });

  it("returns the failure without data when the server cannot be reached", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    const { result } = await renderHook(useReportScope, { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBeUndefined();
  });
});

describe("useReportOverview", () => {
  it("returns the overview for the year under the web's key, with no types", async () => {
    const { result } = await renderHook(() => useReportOverview({ year: 2026 }), { wrapper });

    await waitFor(() => expect(result.current.data?.year).toBe(2026));
    const [url] = urlsOf("/api/reports/overview");
    expect(url).toMatch(/\/api\/reports\/overview\?year=2026$/);
    expect(new URL(url).searchParams.has("types")).toBe(false);
    expect(queryClient.getQueryData(["report-overview", "year=2026"])).toBeDefined();
  });

  it("returns the groups and people picked in the request and the key, as the web writes them", async () => {
    const filters: ReportFilters = { year: 2025, groupIds: ["g-1", "g-2"], userIds: ["u-1"] };
    const { result } = await renderHook(() => useReportOverview(filters), { wrapper });

    await waitFor(() => expect(result.current.data?.year).toBe(2025));
    const query = "year=2025&groupIds=g-1%2Cg-2&userIds=u-1";
    expect(urlsOf("/api/reports/overview")).toEqual([
      expect.stringMatching(new RegExp(`/api/reports/overview\\?${query}$`)),
    ]);
    expect(queryClient.getQueryData(["report-overview", query])).toBeDefined();
  });

  it("returns nothing and reads nothing while disabled", async () => {
    const { result } = await renderHook(() => useReportOverview({ year: 2026 }, false), {
      wrapper,
    });

    expect(result.current.data).toBeUndefined();
    expect(urlsOf("/api/reports/overview")).toEqual([]);
  });

  it("returns the previous answer as placeholder data while a new filter loads", async () => {
    let release: () => void = () => undefined;
    const { result, rerender } = await renderHook(
      ({ year }: { year: number }) => useReportOverview({ year }),
      { wrapper, initialProps: { year: 2026 } }
    );
    await waitFor(() => expect(result.current.data?.year).toBe(2026));

    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(reply(200, reportOverview({ year: 2025 })));
        })
    );
    await rerender({ year: 2025 });

    expect(result.current.data?.year).toBe(2026);
    expect(result.current.isPlaceholderData).toBe(true);

    await act(async () => release());
    await waitFor(() => expect(result.current.data?.year).toBe(2025));
    expect(result.current.isPlaceholderData).toBe(false);
  });
});

describe("useMemberReport", () => {
  it("returns one person's year from /api/reports/members under the web's key", async () => {
    const { result } = await renderHook(() => useMemberReport("u-erin", 2026), { wrapper });

    await waitFor(() => expect(result.current.data?.year).toBe(2026));
    expect(urlsOf("/api/reports/members")).toEqual([
      expect.stringMatching(/\/api\/reports\/members\/u-erin\?year=2026$/),
    ]);
    expect(queryClient.getQueryData(["member-report", "u-erin", 2026])).toEqual(
      memberReport({ year: 2026 })
    );
  });

  it("returns nothing and reads nothing while disabled", async () => {
    const { result } = await renderHook(() => useMemberReport("u-erin", 2025, false), {
      wrapper,
    });

    expect(result.current.data).toBeUndefined();
    expect(urlsOf("/api/reports/members")).toEqual([]);
  });

  it("returns the previous year as placeholder data while another year loads", async () => {
    let release: () => void = () => undefined;
    const { result, rerender } = await renderHook(
      ({ year }: { year: number }) => useMemberReport("u-erin", year),
      { wrapper, initialProps: { year: 2026 } }
    );
    await waitFor(() => expect(result.current.data?.year).toBe(2026));

    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(reply(200, memberReport({ year: 2025 })));
        })
    );
    await rerender({ year: 2025 });

    expect(result.current.data?.year).toBe(2026);
    expect(result.current.isPlaceholderData).toBe(true);

    await act(async () => release());
    await waitFor(() => expect(result.current.data?.year).toBe(2025));
    expect(result.current.isPlaceholderData).toBe(false);
  });
});

describe("useRereadReportOnFocus", () => {
  it("returns to the screen reading the scope, the overview and the member report again", async () => {
    await renderHook(
      () => {
        useReportScope();
        useReportOverview({ year: 2026 });
        useMemberReport("u-erin", 2026);
        useRereadReportOnFocus();
      },
      { wrapper }
    );
    await waitFor(() => expect(urlsOf("/api/reports/overview")).toHaveLength(1));
    await waitFor(() => expect(urlsOf("/api/reports/members")).toHaveLength(1));
    await act(async () => mockFocus());

    await act(async () => mockFocus());

    await waitFor(() => expect(urlsOf("/api/reports/overview")).toHaveLength(2));
    expect(urlsOf("/api/reports/scope")).toHaveLength(2);
    await waitFor(() => expect(urlsOf("/api/reports/members")).toHaveLength(2));
  });
});
