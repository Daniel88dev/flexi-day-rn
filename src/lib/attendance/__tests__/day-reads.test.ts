import { QueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";

import { refreshDayView, refreshView } from "../day-reads";

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

const TODAY = "2026-09-27";
const ORG = "org-1";

async function cacheWith(keys: readonly (readonly unknown[])[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const reads = new Map<string, jest.Mock>();
  for (const key of keys) {
    const read = jest.fn().mockResolvedValue({});
    reads.set(JSON.stringify(key), read);
    await client.fetchQuery({ queryKey: key, queryFn: read });
    read.mockClear();
  }
  const reread = () =>
    [...reads.entries()].filter(([, read]) => read.mock.calls.length > 0).map(([key]) => key);
  return { client, reread };
}

const state = qk.attendanceState();
const september = qk.attendanceMonth(2026, 9, ORG);
const august = qk.attendanceMonth(2026, 8, ORG);
const day = (businessDate: string) => qk.attendanceDay({ organizationId: ORG, businessDate });

describe("refreshDayView", () => {
  it("returns once /current, the visible /day and the visible month have answered again", async () => {
    const { client, reread } = await cacheWith([
      state,
      september,
      august,
      day("2026-08-31"),
      day("2026-09-01"),
    ]);

    await refreshDayView(client, { organizationId: ORG, date: "2026-08-31", today: TODAY });

    expect(reread().sort()).toEqual(
      [state, august, day("2026-08-31")].map((key) => JSON.stringify(key)).sort()
    );
  });

  it("reads no /day for today, whose sessions come from /current", async () => {
    const { client, reread } = await cacheWith([state, september, day(TODAY)]);

    await refreshDayView(client, { organizationId: ORG, date: TODAY, today: TODAY });

    expect(reread().sort()).toEqual([state, september].map((key) => JSON.stringify(key)).sort());
  });

  it("reads /current alone before the clock has named the organization", async () => {
    const { client, reread } = await cacheWith([state, september]);

    await refreshDayView(client, { organizationId: null, date: TODAY, today: TODAY });

    expect(reread()).toEqual([JSON.stringify(state)]);
  });

  it("returns even when a read fails", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const read = jest.fn().mockResolvedValueOnce({}).mockRejectedValue(new Error("down"));
    await client.fetchQuery({ queryKey: state, queryFn: read });

    await expect(
      refreshDayView(client, { organizationId: ORG, date: TODAY, today: TODAY })
    ).resolves.toBeUndefined();
  });
});

describe("refreshView", () => {
  const october = qk.attendanceMonth(2026, 10, ORG);

  it("reads /current and both months of a week that straddles them", async () => {
    const { client, reread } = await cacheWith([state, august, september, october, day(TODAY)]);

    await refreshView(client, {
      view: "week",
      organizationId: ORG,
      date: "2026-10-01",
      today: TODAY,
    });

    expect(reread().sort()).toEqual(
      [state, september, october].map((key) => JSON.stringify(key)).sort()
    );
  });

  it.each([["week"], ["month"]] as const)(
    "reads /current alone on the %s view before the clock has named the organization",
    async (view) => {
      const { client, reread } = await cacheWith([state, september]);

      await refreshView(client, { view, organizationId: null, date: TODAY, today: TODAY });

      expect(reread()).toEqual([JSON.stringify(state)]);
    }
  );

  it("reads /current and the one month on the Month view", async () => {
    const { client, reread } = await cacheWith([state, august, september, day(TODAY)]);

    await refreshView(client, {
      view: "month",
      organizationId: ORG,
      date: "2026-08-01",
      today: TODAY,
    });

    expect(reread().sort()).toEqual([state, august].map((key) => JSON.stringify(key)).sort());
  });
});
