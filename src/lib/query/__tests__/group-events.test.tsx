import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { canCreateGroupEvent, useGroupEventGroups } from "@/lib/query/group-events";
import { qk } from "@/lib/query/keys";
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

const GROUPS = [
  { groupId: "g-design", groupName: "Design", canCreate: true },
  { groupId: "g-free", groupName: "Free team", canCreate: false },
];

function Probe() {
  const { data } = useGroupEventGroups();
  return (
    <Text testID="read">
      {data ? data.map((group) => `${group.groupName}:${group.canCreate}`).join(",") : "waiting"}
    </Text>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    status: 200,
    json: async () => GROUPS,
    text: async () => JSON.stringify(GROUPS),
  });
});

afterEach(() => queryClient.clear());

describe("useGroupEventGroups", () => {
  it("reads the viewer's groups and whether each may create, under the web's key", async () => {
    await render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("read")).toHaveTextContent("Design:true,Free team:false")
    );
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/group-events\/groups$/);
    expect(queryClient.getQueryData(["group-events", "groups"])).toEqual(GROUPS);
    expect(qk.groupEventGroups()).toEqual(["group-events", "groups"]);
  });
});

describe("canCreateGroupEvent", () => {
  it("returns the group's own answer in Group scope", () => {
    expect(canCreateGroupEvent(GROUPS, { kind: "group", groupId: "g-design" })).toBe(true);
    expect(canCreateGroupEvent(GROUPS, { kind: "group", groupId: "g-free" })).toBe(false);
    expect(canCreateGroupEvent(GROUPS, { kind: "group", groupId: "g-gone" })).toBe(false);
  });

  it("returns true in Mine scope while any group may create, and false before the read answers", () => {
    expect(canCreateGroupEvent(GROUPS, { kind: "mine" })).toBe(true);
    expect(canCreateGroupEvent([GROUPS[1]], { kind: "mine" })).toBe(false);
    expect(canCreateGroupEvent(undefined, { kind: "mine" })).toBe(false);
  });
});
