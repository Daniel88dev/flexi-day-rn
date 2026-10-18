import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import type { RequestListScope } from "@/lib/local-store";
import {
  canCreateGroupEvent,
  useGroupEventGroups,
  useGroupEventRights,
} from "@/lib/query/group-events";
import type { YearMonth } from "@/lib/requests/months";
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

const EVENTS = [
  {
    id: "ge-1",
    title: "Standup",
    canEdit: false,
    createdBy: { id: "eva", name: "Eva Novak", initials: "EN", avatarColor: "#123456" },
  },
  { id: "ge-2", title: "Retro", canEdit: true, createdBy: null },
];

function RightsProbe({ month, scope }: { month: YearMonth | null; scope: RequestListScope }) {
  const rights = useGroupEventRights(month, scope);
  return (
    <Text testID="rights">
      {rights
        ? [...rights].map(([id, right]) => `${id}:${right.canEdit}:${right.createdBy?.name}`)
        : "waiting"}
    </Text>
  );
}

describe("useGroupEventRights", () => {
  const answer = () =>
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => EVENTS,
      text: async () => JSON.stringify(EVENTS),
    });

  it("reads each event's canEdit and creator for the month, under the web's key", async () => {
    answer();
    await render(
      <QueryClientProvider client={queryClient}>
        <RightsProbe month={{ year: 2026, month: 10 }} scope={{ kind: "mine" }} />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("rights")).toHaveTextContent(
        "ge-1:false:Eva Novakge-2:true:undefined"
      )
    );
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/group-events\?year=2026&month=10$/);
    expect(queryClient.getQueryData(["group-events", 2026, 10, "mine"])).toEqual(EVENTS);
  });

  it("names the group in Group scope", async () => {
    answer();
    await render(
      <QueryClientProvider client={queryClient}>
        <RightsProbe month={{ year: 2026, month: 10 }} scope={{ kind: "group", groupId: "g-1" }} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("rights")).not.toHaveTextContent("waiting"));
    expect(mockFetch.mock.calls[0][0]).toMatch(/year=2026&month=10&groupId=g-1$/);
  });

  it("reads nothing without a month", async () => {
    await render(
      <QueryClientProvider client={queryClient}>
        <RightsProbe month={null} scope={{ kind: "mine" }} />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("rights")).toHaveTextContent("waiting");
    expect(mockFetch).not.toHaveBeenCalled();
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
