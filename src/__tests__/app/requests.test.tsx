import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { ActionSheetIOS } from "react-native";

import RequestsScreen from "@/app/(app)/requests";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  pull,
  useRequestListVacations,
  useRequestScopeGroups,
  type ListedVacation,
} from "@/lib/local-store";
import { authClient } from "@/lib/session/auth-client";
import { SESSION, VIEWER } from "@/test-support/session";

jest.mock("@/lib/local-store", () => ({
  pull: jest.fn(),
  useRequestListVacations: jest.fn(),
  useRequestScopeGroups: jest.fn(),
}));

jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

jest.mock("@/lib/session/auth-client", () => ({ authClient: { useSession: jest.fn() } }));

const pullStore = pull as jest.MockedFunction<typeof pull>;
const listRows = useRequestListVacations as jest.MockedFunction<typeof useRequestListVacations>;
const scopeGroups = useRequestScopeGroups as jest.MockedFunction<typeof useRequestScopeGroups>;
const useSession = authClient.useSession as unknown as jest.Mock;

const GROUPS = [
  { groupId: "g-1", groupName: "Engineering" },
  { groupId: "g-2", groupName: "Support" },
];

function day(id: string, requestedDay: string, patch: Partial<ListedVacation> = {}) {
  return {
    id,
    userId: "user-2",
    groupId: "g-1",
    organizationId: "org-1",
    requestId: "request-1",
    requestedDay,
    startTime: null,
    endTime: null,
    vacationType: "VACATION",
    halfDay: false,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    note: null,
    createdByUserId: null,
    deletedAt: null,
    deletedByUserId: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    status: "pending",
    pending: false,
    actionsDisabled: false,
    userName: "Eva Horáková",
    groupName: "Engineering",
    ...patch,
  } satisfies ListedVacation;
}

const ROWS: ListedVacation[] = [
  day("eva-1", "2026-09-14"),
  day("eva-2", "2026-09-15"),
  day("mine-1", "2026-09-21", { userId: VIEWER.id, status: "approved" }),
];

let choose: (index: number) => void = () => {};
jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, cb) => {
  choose = cb;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date(2026, 8, 26, 12), doNotFake: ["setImmediate", "nextTick"] });
  useSession.mockReturnValue(SESSION);
  pullStore.mockResolvedValue({ ok: true });
  scopeGroups.mockReturnValue(GROUPS);
  listRows.mockReturnValue(ROWS);
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderRequests() {
  await render(
    <TranslationProvider>
      <RequestsScreen />
    </TranslationProvider>
  );
}

function lastQuery() {
  return listRows.mock.calls.at(-1)?.[0];
}

describe("RequestsScreen", () => {
  it("renders one card per run of the store's rows", async () => {
    await renderRequests();

    expect(screen.getByTestId("request-run-eva-1")).toHaveTextContent(/14-15 Sep/);
    expect(screen.getByTestId("request-run-mine-1")).toHaveTextContent(/You · Engineering/);
    expect(screen.queryByTestId("request-run-eva-2")).toBeNull();
  });

  it("opens the detail of the run's first day when a card is tapped", async () => {
    await renderRequests();

    await fireEvent.press(screen.getByTestId("request-run-eva-1"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/requests/[vacationId]",
      params: { vacationId: "eva-1" },
    });
  });

  it("opens the new-request form from the header's +", async () => {
    await renderRequests();

    await fireEvent.press(screen.getByTestId("requests-new-request"));

    expect(router.push).toHaveBeenCalledWith("/requests/new");
  });

  it("renders the chips' counts over runs, not days", async () => {
    await renderRequests();

    expect(screen.getByTestId("requests-filter-all")).toHaveTextContent("All2");
    expect(screen.getByTestId("requests-filter-mine")).toHaveTextContent("Mine1");
    expect(screen.getByTestId("requests-filter-pending")).toHaveTextContent("Pending1");
  });

  it("renders only the viewer's runs under Mine", async () => {
    await renderRequests();

    await fireEvent.press(screen.getByTestId("requests-filter-mine"));

    expect(screen.getByTestId("request-run-mine-1")).toBeTruthy();
    expect(screen.queryByTestId("request-run-eva-1")).toBeNull();
  });

  it("renders the filtered empty state when a chip matches nothing", async () => {
    await renderRequests();

    await fireEvent.press(screen.getByTestId("requests-filter-rejected"));

    expect(screen.getByText(en.requests.emptyFiltered(en.status.rejected))).toBeTruthy();
  });

  it("reads this month of the first group by default", async () => {
    await renderRequests();

    expect(screen.getByTestId("requests-scope")).toHaveTextContent("Engineering");
    expect(lastQuery()).toEqual({
      month: { year: 2026, month: 9 },
      scope: { kind: "group", groupId: "g-1" },
    });
  });

  it("reads the viewer's own rows once Mine is picked in the scope menu", async () => {
    await renderRequests();

    await fireEvent.press(screen.getByTestId("requests-scope"));
    await act(async () => choose(GROUPS.length));

    expect(lastQuery()).toEqual({ month: { year: 2026, month: 9 }, scope: { kind: "mine" } });
    expect(screen.getByTestId("requests-scope")).toHaveTextContent(en.requests.scopeMine);
  });

  it("reads the viewer's own rows, with no menu, when no group is seen in full", async () => {
    scopeGroups.mockReturnValue([]);

    await renderRequests();

    expect(screen.queryByTestId("requests-scope")).toBeNull();
    expect(lastQuery()).toEqual({ month: { year: 2026, month: 9 }, scope: { kind: "mine" } });
  });

  it("reads the month the stepper moves to", async () => {
    await renderRequests();

    await fireEvent.press(screen.getByTestId("requests-month-next"));

    expect(screen.getByTestId("requests-month")).toHaveTextContent("October 2026");
    expect(lastQuery()).toEqual({
      month: { year: 2026, month: 10 },
      scope: { kind: "group", groupId: "g-1" },
    });
  });

  it("stops the stepper at January of last year", async () => {
    await renderRequests();

    for (let step = 0; step < 24; step += 1) {
      await fireEvent.press(screen.getByTestId("requests-month-previous"));
    }

    expect(screen.getByTestId("requests-month")).toHaveTextContent("January 2025");
    expect(screen.getByTestId("requests-month-previous")).toBeDisabled();
  });

  it("runs a sync pull on pull-to-refresh", async () => {
    await renderRequests();

    await act(async () =>
      screen.getByTestId("requests-list").props.refreshControl.props.onRefresh()
    );

    expect(pullStore).toHaveBeenCalledWith("refresh");
  });
});
