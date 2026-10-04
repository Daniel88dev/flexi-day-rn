import { QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { ApiError } from "@/lib/query/failure";
import {
  useAdministeredGroups,
  useGroupDetail,
  useGroupMembers,
  useHolidayCountries,
  useQuotas,
} from "@/lib/query/groups";
import { qk } from "@/lib/query/keys";
import { queryClient } from "@/lib/query/runtime";
import { administeredGroup, groupDetail, groupMember, userYearQuota } from "@/test-support/groups";

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

const COUNTRIES = [
  { code: "CZ", name: "Czechia" },
  { code: "SK", name: "Slovakia" },
];

const DETAIL = groupDetail({
  organization: { name: "Olivia Owner", sickDayBenefitActive: true },
  holidayCountry: "CZ",
  uploadsAvailable: true,
});
const MEMBER = groupMember("alice", "Alice Novak", { approverAccess: true, controlledUser: false });
const QUOTA = userYearQuota("alice");

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const requestedPath = (call = 0) => String(mockFetch.mock.calls[call][0]);

function CountriesProbe({ enabled }: { enabled?: boolean }) {
  const { data } = useHolidayCountries({ enabled });
  return <Text testID="countries">{data ? data.map((c) => c.name).join(", ") : "waiting"}</Text>;
}

async function renderProbe(enabled?: boolean) {
  await render(
    <QueryClientProvider client={queryClient}>
      <CountriesProbe enabled={enabled} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(answer(200, COUNTRIES));
});

afterEach(() => queryClient.clear());

describe("useHolidayCountries", () => {
  it("returns the countries the backend's holiday dataset supports", async () => {
    await renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("countries")).toHaveTextContent("Czechia, Slovakia")
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/bank-holidays\/countries$/);
    expect(init?.method).toBeUndefined();
  });

  it("returns the answer under the web's key", async () => {
    await renderProbe();

    await waitFor(() =>
      expect(queryClient.getQueryData(qk.bankHolidayCountries())).toEqual(COUNTRIES)
    );
  });

  it("sends nothing while it is not enabled", async () => {
    await renderProbe(false);

    expect(screen.getByTestId("countries")).toHaveTextContent("waiting");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useGroupDetail", () => {
  it("returns the group with its full access and organization badge from /api/group/:id", async () => {
    mockFetch.mockResolvedValue(answer(200, DETAIL));

    const { result } = await renderHook(() => useGroupDetail("group-1"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(DETAIL));
    expect(requestedPath()).toMatch(/\/api\/group\/group-1$/);
    expect(mockFetch.mock.calls[0][1]?.method).toBeUndefined();
    expect(result.current.data?.access).toEqual({
      canView: true,
      canAdmin: false,
      viaOrgAdmin: false,
      isMember: true,
    });
    expect(result.current.data?.organization?.sickDayBenefitActive).toBe(true);
  });

  it("returns the answer under the web's group key", async () => {
    mockFetch.mockResolvedValue(answer(200, DETAIL));

    await renderHook(() => useGroupDetail("group-1"), { wrapper });

    await waitFor(() => expect(queryClient.getQueryData(["group", "group-1"])).toEqual(DETAIL));
  });

  it("returns a 403 as an ApiError, tried only once", async () => {
    mockFetch.mockResolvedValue(
      answer(403, { errors: [{ message: "No access for related group" }] })
    );

    const { result } = await renderHook(() => useGroupDetail("group-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("escapes the group id in the path", async () => {
    mockFetch.mockResolvedValue(answer(200, DETAIL));

    await renderHook(() => useGroupDetail("a/b"), { wrapper });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(requestedPath()).toMatch(/\/api\/group\/a%2Fb$/);
  });

  it("reads nothing without a group", async () => {
    await renderHook(() => useGroupDetail(null), { wrapper });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useGroupMembers", () => {
  it("returns the members with their four flags and email from /api/group-user/:groupId", async () => {
    mockFetch.mockResolvedValue(answer(200, [MEMBER]));

    const { result } = await renderHook(() => useGroupMembers("group-1"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([MEMBER]));
    expect(requestedPath()).toMatch(/\/api\/group-user\/group-1$/);
  });

  it("returns the answer under the web's group-users key", async () => {
    mockFetch.mockResolvedValue(answer(200, [MEMBER]));

    await renderHook(() => useGroupMembers("group-1"), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryData(["group-users", "group-1"])).toEqual([MEMBER])
    );
  });

  it("reads nothing without a group", async () => {
    await renderHook(() => useGroupMembers(null), { wrapper });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useQuotas", () => {
  it("returns one year's allowances for every member from /api/quotas/:groupId", async () => {
    mockFetch.mockResolvedValue(answer(200, [QUOTA]));

    const { result } = await renderHook(() => useQuotas("group-1", 2026), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([QUOTA]));
    expect(requestedPath()).toMatch(/\/api\/quotas\/group-1\?year=2026$/);
  });

  it("returns the answer under the web's quotas key for all members", async () => {
    mockFetch.mockResolvedValue(answer(200, [QUOTA]));

    await renderHook(() => useQuotas("group-1", 2026), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryData(["quotas", "group-1", 2026, "all"])).toEqual([QUOTA])
    );
  });

  it("reads nothing without a group", async () => {
    await renderHook(() => useQuotas(null, 2026), { wrapper });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useAdministeredGroups", () => {
  const ADMINISTERED = [
    administeredGroup(),
    administeredGroup({
      id: "group-3",
      groupName: "Field Ops",
      memberCount: 1,
      viaOrgAdmin: false,
    }),
  ];

  it("returns the groups the viewer administers without a membership from /api/group/administered", async () => {
    mockFetch.mockResolvedValue(answer(200, ADMINISTERED));

    const { result } = await renderHook(() => useAdministeredGroups(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(ADMINISTERED));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(requestedPath()).toMatch(/\/api\/group\/administered$/);
    expect(mockFetch.mock.calls[0][1]?.method).toBeUndefined();
    expect(
      result.current.data?.map(({ memberCount, viaOrgAdmin }) => [memberCount, viaOrgAdmin])
    ).toEqual([
      [3, true],
      [1, false],
    ]);
  });

  it("returns the answer under the web's groups prefix", async () => {
    mockFetch.mockResolvedValue(answer(200, ADMINISTERED));

    await renderHook(() => useAdministeredGroups(), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryData(["groups", "administered"])).toEqual(ADMINISTERED)
    );
    expect(queryClient.getQueriesData({ queryKey: ["groups"] })).toHaveLength(1);
  });

  it("returns an empty list for a viewer who administers nothing", async () => {
    mockFetch.mockResolvedValue(answer(200, []));

    const { result } = await renderHook(() => useAdministeredGroups(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([]));
  });
});
