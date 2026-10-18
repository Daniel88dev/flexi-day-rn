import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { pull } from "@/lib/local-store";
import { ApiError } from "@/lib/query/failure";
import { useGroupEventWrites } from "@/lib/query/group-events";
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
jest.mock("@/lib/local-store", () => ({ pull: jest.fn().mockResolvedValue({ ok: true }) }));

const WRITTEN = { droppedOneOffs: 0, events: [], deletedIds: [] };

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function renderWrites() {
  const { result } = await renderHook(() => useGroupEventWrites(), { wrapper: Wrapper });
  return result;
}

function lastCall() {
  const [url, init] = mockFetch.mock.calls.at(-1) as [string, RequestInit | undefined];
  return {
    url: url.replace(/^https?:\/\/[^/]+/, ""),
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(answer(200, WRITTEN));
});

afterEach(() => queryClient.clear());

const STANDUP = {
  groupId: "g-1",
  title: "Standup",
  note: null,
  startDate: "2026-10-21",
  endDate: "2026-10-21",
  startTime: "09:30",
  endTime: "09:45",
  repeat: null,
};

describe("useGroupEventWrites", () => {
  it("posts a new group event, then pulls", async () => {
    const writes = (await renderWrites()).current;

    await act(() => writes.create(STANDUP));

    expect(lastCall()).toEqual({ url: "/api/group-events", method: "POST", body: STANDUP });
    expect(pull).toHaveBeenCalledWith("after-write");
  });

  it("patches one occurrence with its scope, then pulls", async () => {
    const writes = (await renderWrites()).current;
    const request = {
      scope: "this" as const,
      occurrenceDate: "2026-10-14",
      changes: { title: "Moved" },
    };

    await act(() => writes.update("ge-1", request));

    expect(lastCall()).toEqual({ url: "/api/group-events/ge-1", method: "PATCH", body: request });
    expect(pull).toHaveBeenCalledWith("after-write");
  });

  it("deletes with the scope in the query, then pulls", async () => {
    const writes = (await renderWrites()).current;

    await act(() => writes.remove("ge-1", { scope: "following", occurrenceDate: "2026-10-14" }));

    expect(lastCall()).toMatchObject({
      url: "/api/group-events/ge-1?scope=following&occurrenceDate=2026-10-14",
      method: "DELETE",
    });
    expect(pull).toHaveBeenCalledWith("after-write");
  });

  it("deletes a one-off without a query", async () => {
    const writes = (await renderWrites()).current;

    await act(() => writes.remove("ge-2", {}));

    expect(lastCall()).toMatchObject({ url: "/api/group-events/ge-2", method: "DELETE" });
  });

  it("returns how many one-off changes an edit would drop, writing nothing", async () => {
    mockFetch.mockResolvedValue(answer(200, { droppedOneOffs: 2 }));
    const writes = (await renderWrites()).current;

    const dropped = await writes.impact("ge-1", {
      scope: "all",
      occurrenceDate: "2026-10-14",
      changes: { repeat: null },
    });

    expect(dropped).toBe(2);
    const { url, method } = lastCall();
    expect(method).toBe("GET");
    const query = new URLSearchParams(url.split("?")[1]);
    expect(url.split("?")[0]).toBe("/api/group-events/ge-1/impact");
    expect(query.get("scope")).toBe("all");
    expect(query.get("occurrenceDate")).toBe("2026-10-14");
    expect(JSON.parse(query.get("changes") ?? "")).toEqual({ repeat: null });
    expect(pull).not.toHaveBeenCalled();
  });

  it("reads the create rights again and pulls when the plan refuses", async () => {
    mockFetch.mockResolvedValue(
      answer(402, {
        errors: [
          {
            message: "Group events need a paid plan",
            context: { reason: "PLAN_LIMIT", code: "GROUP_EVENTS_PLAN_REQUIRED" },
          },
        ],
      })
    );
    queryClient.setQueryData(["group-events", "groups"], []);
    const writes = (await renderWrites()).current;

    await expect(act(() => writes.create(STANDUP))).rejects.toBeInstanceOf(ApiError);

    await waitFor(() =>
      expect(queryClient.getQueryState(["group-events", "groups"])?.isInvalidated).toBe(true)
    );
    expect(pull).toHaveBeenCalledWith("refresh");
  });
});
