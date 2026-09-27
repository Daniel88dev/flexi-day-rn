import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { QueryLayer } from "@/lib/query/query-layer";
import { apiRequest, queryClient } from "@/lib/query/runtime";

const mockFetch = jest.fn();

// The factory runs before `mockFetch` is assigned, so it reaches it through a closure.
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
jest.mock("expo-network", () => ({
  addNetworkStateListener: () => ({ remove: () => undefined }),
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));

function answer401() {
  mockFetch.mockResolvedValue({ status: 401, json: async () => ({ message: "Unauthorized" }) });
}

function ClientProbe() {
  return <Text>{useQueryClient() === queryClient ? "the shared client" : "another client"}</Text>;
}

afterEach(() => queryClient.clear());

describe("QueryLayer", () => {
  it("gives the screens under it the one shared query client", async () => {
    await render(
      <QueryLayer onUnauthorized={jest.fn()}>
        <ClientProbe />
      </QueryLayer>
    );

    expect(screen.getByText("the shared client")).toBeOnTheScreen();
  });

  it("hands a 401 from any request to the Signed-out wipe it was given", async () => {
    const onUnauthorized = jest.fn();
    await render(
      <QueryLayer onUnauthorized={onUnauthorized}>
        <ClientProbe />
      </QueryLayer>
    );
    answer401();

    await apiRequest("/api/attendance/current").catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("stops handing 401s to the shell once the shell is gone, and only clears the cache", async () => {
    const onUnauthorized = jest.fn();
    const { unmount } = await render(
      <QueryLayer onUnauthorized={onUnauthorized}>
        <ClientProbe />
      </QueryLayer>
    );
    await unmount();
    queryClient.setQueryData(["my-approvals"], []);
    answer401();

    await apiRequest("/api/users/me/approvals").catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });
});
