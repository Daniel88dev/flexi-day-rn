import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import {
  useDirectoryOrganizations,
  useDirectoryPeople,
  useDirectoryProfile,
  useFormerDirectoryPeople,
  useRereadDirectoryOnFocus,
} from "@/lib/query/directory";
import { qk } from "@/lib/query/keys";
import { queryClient } from "@/lib/query/runtime";

const mockFetch = jest.fn();
let mockFocus: () => void = () => undefined;

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
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
}));

function answer(status: number, body: unknown) {
  return { status, json: async () => body };
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const paths = () => mockFetch.mock.calls.map(([url]) => new URL(String(url)).pathname);
const urls = () =>
  mockFetch.mock.calls.map(([url]) => {
    const parsed = new URL(String(url));
    return `${parsed.pathname}${parsed.search}`;
  });

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue(answer(200, []));
  queryClient.clear();
});

describe("useDirectoryOrganizations", () => {
  it("returns the organizations under the web's key", async () => {
    const organizations = [{ organizationId: "o-a", name: "Acme" }];
    mockFetch.mockResolvedValue(answer(200, organizations));
    const { result } = await renderHook(useDirectoryOrganizations, { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(paths()).toEqual(["/api/directory/organizations"]);
    expect(queryClient.getQueryData(qk.directoryOrganizations())).toEqual(organizations);
  });

  it("returns a failure for an answer that is not a list", async () => {
    mockFetch.mockResolvedValue(answer(200, { error: "old backend" }));
    const { result } = await renderHook(useDirectoryOrganizations, { wrapper });

    // A wrong shape reads like an outage, so the one retry runs first.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
    expect(result.current.data).toBeUndefined();
  });
});

describe("useDirectoryPeople", () => {
  it("returns one organization's people, encoded, and keeps nothing once unmounted", async () => {
    mockFetch.mockResolvedValue(answer(200, { people: [], formerList: false }));
    const { result, unmount } = await renderHook(() => useDirectoryPeople("o/a"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls()).toEqual(["/api/directory/o%2Fa/people"]);
    await act(async () => unmount());
    await waitFor(() =>
      expect(queryClient.getQueryData(qk.directoryPeople("o/a"))).toBeUndefined()
    );
  });

  it("returns nothing without an organization", async () => {
    const { result } = await renderHook(() => useDirectoryPeople(null), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useFormerDirectoryPeople", () => {
  it("returns the Former list only when the list allows it", async () => {
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useFormerDirectoryPeople("o-a", enabled),
      { wrapper, initialProps: { enabled: false } }
    );
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => rerender({ enabled: true }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls()).toEqual(["/api/directory/o-a/former"]);
  });
});

describe("useDirectoryProfile", () => {
  it("returns one profile in the asked language, under a key that carries it", async () => {
    const profile = { employmentId: "e/1", name: "Ada" };
    mockFetch.mockResolvedValue(answer(200, profile));
    const { result } = await renderHook(() => useDirectoryProfile("o-a", "e/1", "cs"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls()).toEqual(["/api/directory/o-a/people/e%2F1?language=cs"]);
    expect(queryClient.getQueryData(qk.directoryProfile("o-a", "e/1", "cs"))).toEqual(profile);
    expect(queryClient.getQueryData(qk.directoryProfile("o-a", "e/1", "en"))).toBeUndefined();
  });

  it("returns nothing until both ids are known", async () => {
    const { result } = await renderHook(() => useDirectoryProfile("o-a", null, "en"), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useRereadDirectoryOnFocus", () => {
  it("reads every directory query again when the screen comes back into focus", async () => {
    mockFetch.mockResolvedValue(answer(200, { people: [], formerList: false }));
    await renderHook(
      () => {
        useDirectoryPeople("o-a");
        useRereadDirectoryOnFocus();
      },
      { wrapper }
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    await act(async () => mockFocus());
    await act(async () => mockFocus());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
