import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useReportWindow, type ReportSource } from "@/lib/query/report-window";
import { queryClient } from "@/lib/query/runtime";
import type { ReportPeriod, ReportScope } from "@/lib/report";
import {
  CROSS_YEAR_TODAY,
  crossMember2025,
  crossMember2026,
  crossOverview,
  crossScope,
} from "@/test-support/report";

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
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

type Reply = { status: number; body?: unknown } | "offline" | "hold";

const reply = (status: number, body: unknown) => ({ status, json: async () => body });
const held: (() => void)[] = [];

const crossMember = (year: number) => (year === 2025 ? crossMember2025 : crossMember2026);

function answer({
  scope = { status: 200, body: crossScope },
  years = {},
  members = {},
}: { scope?: Reply; years?: Record<number, Reply>; members?: Record<number, Reply> } = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    const route = (pick: Reply, body: () => unknown) => {
      if (pick === "offline") throw new TypeError("Network request failed");
      if (pick === "hold") {
        return new Promise((resolve) => held.push(() => resolve(reply(200, body()))));
      }
      return reply(pick.status, pick.body ?? body());
    };
    if (url.includes("/api/reports/scope")) return route(scope, () => crossScope);
    if (url.includes("/api/reports/overview")) {
      const year = Number(new URL(url).searchParams.get("year"));
      return route(years[year] ?? { status: 200 }, () => crossOverview(year));
    }
    if (url.includes("/api/reports/members/u-bob")) {
      const year = Number(new URL(url).searchParams.get("year"));
      return route(members[year] ?? { status: 200 }, () => crossMember(year));
    }
    return reply(404, {});
  });
}

const overviewUrls = (year: number) =>
  mockFetch.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes("/api/reports/overview") && url.includes(`year=${year}`));
const memberUrls = () =>
  mockFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/members/"));
const scopeUrls = () =>
  mockFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/scope"));

const releaseAll = async () => {
  await act(async () => {
    for (const release of held.splice(0)) release();
  });
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const EVERYONE: ReportSource = { kind: "overview" };

async function renderWindow(period: ReportPeriod = "rolling", source: ReportSource = EVERYONE) {
  return renderHook(
    (props: { period: ReportPeriod; source: ReportSource }) =>
      useReportWindow(props.period, props.source),
    { wrapper, initialProps: { period, source } }
  );
}

const yearsIn = (usage: { year: number }[]) => Array.from(new Set(usage.map((row) => row.year)));

beforeEach(() => {
  jest.clearAllMocks();
  held.length = 0;
  jest.useFakeTimers({
    now: CROSS_YEAR_TODAY,
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
    ],
  });
  answer();
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

describe("useReportWindow", () => {
  it("returns the last twelve months and reads both years when the scope lists the prior one", async () => {
    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.slots[0]).toEqual({ year: 2025, month: 3 });
    expect(result.current.slots[11]).toEqual({ year: 2026, month: 2 });
    expect(result.current.year).toBe(2026);
    expect(result.current.priorYear).toBe(2025);
    expect(result.current.data?.year).toBe(2026);
    expect(yearsIn(result.current.usage)).toEqual([2025, 2026]);
    expect(overviewUrls(2025)).toHaveLength(1);
    expect(overviewUrls(2026)).toHaveLength(1);
  });

  it("returns ready without a prior-year read when the scope does not list the prior year", async () => {
    const scope: ReportScope = { ...crossScope, years: [2026] };
    answer({ scope: { status: 200, body: scope } });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(yearsIn(result.current.usage)).toEqual([2026]);
    expect(overviewUrls(2025)).toEqual([]);
  });

  it("returns one calendar year read for a year period", async () => {
    const { result } = await renderWindow(2025);

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.slots).toHaveLength(12);
    expect(result.current.slots[0]).toEqual({ year: 2025, month: 1 });
    expect(result.current.data?.year).toBe(2025);
    expect(overviewUrls(2025)).toHaveLength(1);
    expect(overviewUrls(2024)).toEqual([]);
    expect(overviewUrls(2026)).toEqual([]);
  });

  it("returns pending while the prior year is outstanding, never half a window", async () => {
    answer({ years: { 2025: "hold" } });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.data?.year).toBe(2026));
    await waitFor(() => expect(held).toHaveLength(1));
    expect(result.current.state).toBe("pending");

    await releaseAll();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(yearsIn(result.current.usage)).toEqual([2025, 2026]);
  });

  it("returns pending while the current year is outstanding", async () => {
    answer({ years: { 2026: "hold" } });

    const { result } = await renderWindow();

    await waitFor(() => expect(overviewUrls(2025)).toHaveLength(1));
    expect(result.current.state).toBe("pending");
    expect(result.current.data).toBeUndefined();

    await releaseAll();
    await waitFor(() => expect(result.current.state).toBe("ready"));
  });

  it("returns pending while a cross-year window waits on the scope", async () => {
    answer({ scope: "hold" });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.data?.year).toBe(2026));
    expect(result.current.state).toBe("pending");
    expect(overviewUrls(2025)).toEqual([]);

    await releaseAll();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(overviewUrls(2025)).toHaveLength(1);
  });

  it("returns pending on placeholder data after a filter change, then ready", async () => {
    const { result, rerender } = await renderWindow();
    await waitFor(() => expect(result.current.state).toBe("ready"));

    answer({ years: { 2025: "hold", 2026: "hold" } });
    await rerender({ period: "rolling", source: { kind: "overview", userIds: ["u-bob"] } });

    expect(result.current.data?.year).toBe(2026);
    expect(result.current.state).toBe("pending");

    await waitFor(() => expect(held).toHaveLength(2));
    await act(async () => held.shift()?.());
    expect(result.current.state).toBe("pending");

    await releaseAll();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(overviewUrls(2026).at(-1)).toMatch(/userIds=u-bob/);
  });

  it("returns incomplete when the prior year fails, with the current year's answer", async () => {
    answer({ years: { 2025: "offline" } });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.state).toBe("incomplete"), { timeout: 5000 });
    expect(result.current.data?.year).toBe(2026);
    expect(yearsIn(result.current.usage)).toEqual([2026]);
    expect(result.current.coldOffline).toBe(false);
  });

  it("returns incomplete when the scope fails on a window that spans two years", async () => {
    answer({ scope: { status: 500, body: {} } });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.state).toBe("incomplete"), { timeout: 5000 });
    expect(result.current.data?.year).toBe(2026);
    expect(overviewUrls(2025)).toEqual([]);
  });

  it("returns ready when the scope fails on a window inside one year", async () => {
    answer({ scope: { status: 500, body: {} } });

    const { result } = await renderWindow(2026);

    await waitFor(() => expect(scopeUrls()).toHaveLength(2), { timeout: 5000 });
    await waitFor(() => expect(result.current.state).toBe("ready"));
  });

  it("returns no prior year from a disabled query's cache", async () => {
    queryClient.setQueryData(["report-overview", "year=2025"], crossOverview(2025));
    answer({ scope: { status: 200, body: { ...crossScope, years: [2026] } } });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(yearsIn(result.current.usage)).toEqual([2026]);
  });

  it("returns the kept answer's time as staleSince when a reread fails", async () => {
    const { result } = await renderWindow();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.staleSince).toBeNull();

    answer({ years: { 2025: "offline", 2026: "offline" } });
    await act(async () => result.current.retry());

    await waitFor(() => expect(result.current.staleSince).not.toBeNull(), { timeout: 5000 });
    expect(result.current.staleSince?.getTime()).toBe(CROSS_YEAR_TODAY.getTime());
    expect(result.current.data?.year).toBe(2026);
    expect(result.current.coldOffline).toBe(false);
  });

  it("returns coldOffline when the first read fails with nothing kept", async () => {
    answer({ years: { 2026: "offline" } });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.coldOffline).toBe(true), { timeout: 5000 });
    expect(result.current.data).toBeUndefined();
    expect(result.current.forbidden).toBe(false);
    expect(result.current.state).toBe("pending");
  });

  it.each([403, 404])("returns forbidden, not coldOffline, on a %i answer", async (status) => {
    answer({ years: { 2026: { status, body: { message: "Not yours" } } } });

    const { result } = await renderWindow();

    await waitFor(() => expect(result.current.forbidden).toBe(true));
    expect(result.current.coldOffline).toBe(false);
  });

  it("returns ready after retry rereads the scope and both years", async () => {
    answer({ years: { 2025: "offline" } });
    const { result } = await renderWindow();
    await waitFor(() => expect(result.current.state).toBe("incomplete"), { timeout: 5000 });
    const before = {
      scope: scopeUrls().length,
      prior: overviewUrls(2025).length,
      current: overviewUrls(2026).length,
    };

    answer();
    await act(async () => result.current.retry());

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(scopeUrls()).toHaveLength(before.scope + 1);
    expect(overviewUrls(2025)).toHaveLength(before.prior + 1);
    expect(overviewUrls(2026)).toHaveLength(before.current + 1);
    expect(yearsIn(result.current.usage)).toEqual([2025, 2026]);
  });
});

const BOB: ReportSource = { kind: "member", userId: "u-bob" };

describe("useReportWindow for a member", () => {
  it("returns the person's report and reads both of their years, and no overview", async () => {
    const { result } = await renderWindow("rolling", BOB);

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.data).toEqual(crossMember2026);
    expect(yearsIn(result.current.usage)).toEqual([2025, 2026]);
    expect(memberUrls()).toEqual([
      expect.stringMatching(/\/api\/reports\/members\/u-bob\?year=2026$/),
      expect.stringMatching(/\/api\/reports\/members\/u-bob\?year=2025$/),
    ]);
    expect(overviewUrls(2026)).toEqual([]);
  });

  it("returns pending while the person's prior year is outstanding", async () => {
    answer({ members: { 2025: "hold" } });

    const { result } = await renderWindow("rolling", BOB);

    await waitFor(() => expect(result.current.data?.year).toBe(2026));
    expect(result.current.state).toBe("pending");
    await releaseAll();
    await waitFor(() => expect(result.current.state).toBe("ready"));
  });

  it("returns pending on the previous year's answer after a period change, then ready", async () => {
    const { result, rerender } = await renderWindow(2026, BOB);
    await waitFor(() => expect(result.current.state).toBe("ready"));
    answer({ members: { 2025: "hold" } });

    await rerender({ period: 2025, source: BOB });

    expect(result.current.data?.year).toBe(2026);
    expect(result.current.state).toBe("pending");
    await releaseAll();
    await waitFor(() => expect(result.current.data?.year).toBe(2025));
    expect(result.current.state).toBe("ready");
  });

  it.each([403, 404])("returns forbidden on a %i answer for the person", async (status) => {
    answer({ members: { 2026: { status, body: { message: "Not yours" } } } });

    const { result } = await renderWindow("rolling", BOB);

    await waitFor(() => expect(result.current.forbidden).toBe(true));
    expect(result.current.coldOffline).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
