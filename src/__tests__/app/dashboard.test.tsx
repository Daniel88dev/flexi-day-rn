import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { toast } from "sonner-native";

import DashboardScreen from "@/app/(app)/dashboard";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { authClient } from "@/lib/session/auth-client";
import { SESSION } from "@/test-support/session";
import {
  pull,
  useGroupStanding,
  useStoreRowCounts,
  useSyncStatus,
  type GroupStanding,
  type PullOutcome,
  type SyncStatus,
  type SyncTableName,
} from "@/lib/local-store";
import {
  useDashboardSummary,
  useRereadDashboard,
  useRereadDashboardOnFocus,
  type DashboardSummary,
} from "@/lib/query";

jest.mock("@/lib/local-store", () => ({
  pull: jest.fn(),
  useGroupStanding: jest.fn(),
  useStoreRowCounts: jest.fn(),
  useSyncStatus: jest.fn(),
}));

jest.mock("@/lib/query", () => ({
  useDashboardSummary: jest.fn(),
  useRereadDashboard: jest.fn(),
  useRereadDashboardOnFocus: jest.fn(),
}));

jest.mock("@/components/dashboard/approvals-card", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    ApprovalsCard: ({ onOpen }: { onOpen: (vacationId: string) => void }) => (
      <Pressable testID="approvals-open" onPress={() => onOpen("vacation-9")}>
        <Text>approvals card</Text>
      </Pressable>
    ),
  };
});

jest.mock("@/components/dashboard/balance-card", () => {
  const { Text } = jest.requireActual("react-native");
  return { BalanceCard: ({ year }: { year: number }) => <Text>{`balance ${year}`}</Text> };
});

jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));

jest.mock("@/lib/session/auth-client", () => ({ authClient: { useSession: jest.fn() } }));

jest.mock("@/components/dashboard/development-card", () => ({ DevelopmentCard: () => null }));

jest.mock("expo-router", () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

jest.mock("@/components/dashboard/dashboard-calendar", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    DashboardCalendar: ({
      onOpenRequest,
      onBook,
      onYear,
    }: {
      onOpenRequest?: (vacationId: string) => void;
      onBook: (day: string) => void;
      onYear?: (year: number) => void;
    }) => (
      <>
        <Pressable testID="calendar-book-day" onPress={() => onBook("2026-10-14")} />
        <Pressable testID="calendar-open-bar" onPress={() => onOpenRequest?.("vacation-7")}>
          <Text>month calendar</Text>
        </Pressable>
        <Pressable testID="calendar-next-year" onPress={() => onYear?.(2031)} />
      </>
    ),
  };
});

const pullStore = pull as jest.MockedFunction<typeof pull>;
const rowCounts = useStoreRowCounts as jest.MockedFunction<typeof useStoreRowCounts>;
const status = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;
const toastError = toast.error as jest.MockedFunction<typeof toast.error>;
const useSession = authClient.useSession as unknown as jest.Mock;
const standing = useGroupStanding as jest.MockedFunction<typeof useGroupStanding>;
const summary = useDashboardSummary as jest.MockedFunction<typeof useDashboardSummary>;
const rereadDashboard = jest.fn();

const SUMMARY: DashboardSummary = {
  pendingApprovalsCount: 2,
  outTodayCount: 3,
  workingTodayCount: 5,
  upcomingNext14DaysCount: 4,
  teamSize: 8,
};

const MEMBER: GroupStanding = { member: true, approver: false };
const APPROVER: GroupStanding = { member: true, approver: true };

const NO_ROWS: Record<SyncTableName, number> = {
  organizations: 0,
  users: 0,
  groups: 0,
  groupUsers: 0,
  groupMirrors: 0,
  userYearQuotas: 0,
  bankHolidays: 0,
  vacations: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  pullStore.mockResolvedValue({ ok: true });
  useSession.mockReturnValue(SESSION);
  standing.mockReturnValue(MEMBER);
  summary.mockReturnValue({ state: "ready", summary: SUMMARY });
  (useRereadDashboard as jest.Mock).mockReturnValue(rereadDashboard);
});

function fakeStore(
  patch: Partial<SyncStatus> & { counts?: Record<SyncTableName, number> } = {}
): void {
  const { counts = NO_ROWS, ...syncStatus } = patch;
  rowCounts.mockReturnValue(counts);
  status.mockReturnValue({
    inFlight: false,
    lastPulledAt: null,
    lastError: null,
    hasCursor: false,
    generation: 0,
    ...syncStatus,
  });
}

function renderDashboard() {
  return render(
    <TranslationProvider>
      <DashboardScreen />
    </TranslationProvider>
  );
}

/** The refresh control rides the scroll view as a prop, which is where a test reads it. */
function refreshControl() {
  return screen.getByTestId("dashboard").props.refreshControl.props as {
    refreshing: boolean;
    onRefresh: () => void;
  };
}

/** Holds the pull open, the way a loop with a rerun queued behind it does. */
function holdPull(): (outcome: PullOutcome) => Promise<void> {
  let settle: (outcome: PullOutcome) => void = () => {};
  pullStore.mockReturnValue(
    new Promise<PullOutcome>((resolve) => {
      settle = resolve;
    })
  );

  return async (outcome) => {
    await act(async () => settle(outcome));
  };
}

async function pullToRefresh(): Promise<void> {
  await act(async () => refreshControl().onRefresh());
}

describe("DashboardScreen", () => {
  it("greets the first name of the session's user", async () => {
    fakeStore();

    await renderDashboard();

    expect(screen.getByText(/Dana$/)).toBeTruthy();
  });

  it("greets nobody in particular while no session has been read", async () => {
    useSession.mockReturnValue({ data: null });
    fakeStore();

    await renderDashboard();

    expect(screen.getByText(new RegExp(`${en.dashboard.fallbackName}$`))).toBeTruthy();
  });

  it("renders the empty card while the store is empty and nothing is pulling", async () => {
    fakeStore();

    await renderDashboard();

    expect(screen.getByText(en.dashboard.empty.title)).toBeTruthy();
    expect(screen.queryByText(en.sync.syncing)).toBeNull();
  });

  it("renders Syncing… in place of the empty card while the first pull runs", async () => {
    fakeStore({ inFlight: true });

    await renderDashboard();

    expect(screen.getByText(en.sync.syncing)).toBeTruthy();
    expect(screen.queryByText(en.dashboard.empty.title)).toBeNull();
  });

  it("renders neither card once the store holds rows", async () => {
    fakeStore({ counts: { ...NO_ROWS, vacations: 3 }, inFlight: true });

    await renderDashboard();

    expect(screen.queryByText(en.dashboard.empty.title)).toBeNull();
    expect(screen.queryByText(en.sync.syncing)).toBeNull();
  });

  it("renders the month calendar once the store holds rows", async () => {
    fakeStore({ counts: { ...NO_ROWS, groups: 1 } });

    await renderDashboard();

    expect(screen.getByText("month calendar")).toBeTruthy();
  });

  it("opens a request's detail from a bar or a day row of the calendar", async () => {
    fakeStore({ counts: { ...NO_ROWS, groups: 1 } });
    await renderDashboard();

    await fireEvent.press(screen.getByTestId("calendar-open-bar"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/requests/[vacationId]",
      params: { vacationId: "vacation-7" },
    });
  });

  it("renders no month calendar while the store is empty", async () => {
    fakeStore();

    await renderDashboard();

    expect(screen.queryByText("month calendar")).toBeNull();
  });

  it("renders the new-request button in the header", async () => {
    fakeStore();

    await renderDashboard();

    expect(screen.getByTestId("dashboard-new-request").props.accessibilityLabel).toBe(
      en.dashboard.newRequest
    );
  });

  it("opens the new-request form from the header's +", async () => {
    fakeStore();
    await renderDashboard();

    await fireEvent.press(screen.getByTestId("dashboard-new-request"));

    expect(router.push).toHaveBeenCalledWith({ pathname: "/requests/new", params: {} });
  });

  it("opens the new-request form on the day a day list's Book was tapped for", async () => {
    fakeStore({ counts: { ...NO_ROWS, groups: 1 } });
    await renderDashboard();

    await fireEvent.press(screen.getByTestId("calendar-book-day"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/requests/new",
      params: { date: "2026-10-14" },
    });
  });

  it("renders how fresh what it shows is", async () => {
    fakeStore({ lastPulledAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString() });

    await renderDashboard();

    expect(screen.getByText("Last synced 2 h ago")).toBeTruthy();
  });

  it("keeps the refresh control visible from the gesture until the loop ends", async () => {
    fakeStore();
    const endPull = holdPull();
    await renderDashboard();

    await pullToRefresh();
    expect(pullStore).toHaveBeenCalledWith("refresh");
    expect(refreshControl().refreshing).toBe(true);

    await endPull({ ok: true });

    expect(refreshControl().refreshing).toBe(false);
  });

  it("keeps the refresh control visible until the rerun queued behind it ends", async () => {
    fakeStore();
    const endPull = holdPull();
    await renderDashboard();

    await pullToRefresh();

    // The first loop has ended and its rerun is running, so the pull has not resolved yet.
    await act(async () => {});
    expect(refreshControl().refreshing).toBe(true);

    await endPull({ ok: true });

    expect(refreshControl().refreshing).toBe(false);
  });

  it("leaves the refresh control alone while a foreground pull runs", async () => {
    fakeStore({ inFlight: true });

    await renderDashboard();

    expect(refreshControl().refreshing).toBe(false);
  });

  it("toasts the server's message when a refresh fails", async () => {
    fakeStore();
    const endPull = holdPull();
    await renderDashboard();

    await pullToRefresh();
    await endPull({ ok: false, message: "Your session expired." });

    expect(toastError).toHaveBeenCalledWith("Your session expired.");
  });

  it("toasts the timeout copy when the refresh failed without a message", async () => {
    fakeStore();
    const endPull = holdPull();
    await renderDashboard();

    await pullToRefresh();
    await endPull({ ok: false, message: null });

    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable);
  });

  it("toasts the unreachable copy when the refresh found the device offline", async () => {
    fakeStore();
    pullStore.mockResolvedValue({ ok: false, message: null });
    await renderDashboard();

    await pullToRefresh();

    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable);
  });

  it("toasts the unreachable copy and settles the control when the pull rejects", async () => {
    fakeStore();
    pullStore.mockRejectedValue(new Error("The local store is not open."));
    await renderDashboard();

    await pullToRefresh();

    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable);
    expect(refreshControl().refreshing).toBe(false);
  });

  it("toasts nothing for a refresh that succeeded", async () => {
    fakeStore();
    await renderDashboard();

    await pullToRefresh();

    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts nothing for a foreground pull that failed", async () => {
    fakeStore({ lastError: "The sync pull timed out." });

    await renderDashboard();

    expect(toastError).not.toHaveBeenCalled();
  });

  it("renders Out today, Coming up and Working today for an employee, and no approvals", async () => {
    fakeStore({ counts: { ...NO_ROWS, groups: 1 }, hasCursor: true });

    await renderDashboard();

    expect(screen.queryByTestId("stat-pending")).toBeNull();
    expect(screen.getByTestId("stat-outToday-value")).toHaveTextContent("3");
    expect(screen.getByTestId("stat-comingUp-value")).toHaveTextContent("4");
    expect(screen.getByTestId("stat-workingToday-value")).toHaveTextContent("5");
    expect(screen.queryByText("approvals card")).toBeNull();
  });

  it("renders Pending first and the Approvals card for a viewer who approves in some group", async () => {
    standing.mockReturnValue(APPROVER);
    summary.mockReturnValue({ state: "ready", summary: { ...SUMMARY, pendingApprovalsCount: 0 } });
    fakeStore({ counts: { ...NO_ROWS, groups: 1 }, hasCursor: true });

    await renderDashboard();

    const tiles = screen
      .getAllByTestId(/^stat-(pending|outToday|comingUp|workingToday)$/)
      .map((tile) => tile.props.testID);
    expect(tiles).toEqual(["stat-pending", "stat-outToday", "stat-comingUp", "stat-workingToday"]);
    expect(screen.getByTestId("stat-pending-value")).toHaveTextContent("0");
    expect(screen.getByText("approvals card")).toBeTruthy();
  });

  it("renders a dash in every tile while the summary can't be read", async () => {
    summary.mockReturnValue({ state: "failed" });
    fakeStore({ counts: { ...NO_ROWS, groups: 1 }, hasCursor: true });

    await renderDashboard();

    expect(screen.getAllByText(en.dashboard.stats.noValue)).toHaveLength(3);
  });

  it("opens the requests list from a tile's View requests", async () => {
    fakeStore({ counts: { ...NO_ROWS, groups: 1 }, hasCursor: true });
    await renderDashboard();

    await fireEvent.press(screen.getByTestId("stat-comingUp"));
    await fireEvent.press(screen.getByTestId("stat-panel-view-requests"));

    expect(router.navigate).toHaveBeenCalledWith("/requests");
  });

  it("opens a request's detail from the Approvals card", async () => {
    standing.mockReturnValue(APPROVER);
    fakeStore({ counts: { ...NO_ROWS, groups: 1 }, hasCursor: true });
    await renderDashboard();

    await fireEvent.press(screen.getByTestId("approvals-open"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/requests/[vacationId]",
      params: { vacationId: "vacation-9" },
    });
  });

  it("renders the Balance card for the year the calendar shows", async () => {
    fakeStore({ counts: { ...NO_ROWS, groups: 1 }, hasCursor: true });
    await renderDashboard();
    expect(screen.getByText(`balance ${new Date().getFullYear()}`)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("calendar-next-year"));

    expect(screen.getByText("balance 2031")).toBeTruthy();
  });

  it("renders the no-groups card in place of the calendar once a pull found no membership", async () => {
    standing.mockReturnValue({ member: false, approver: false });
    fakeStore({ counts: { ...NO_ROWS, organizations: 1 }, hasCursor: true });

    await renderDashboard();

    expect(screen.getByText(en.dashboard.noGroups.title)).toBeTruthy();
    expect(screen.queryByText("month calendar")).toBeNull();
    expect(screen.queryByText(/^balance/)).toBeNull();
    expect(screen.queryByText(en.dashboard.empty.title)).toBeNull();
  });

  it("renders no no-groups card before the first pull has finished", async () => {
    standing.mockReturnValue({ member: false, approver: false });
    fakeStore({ inFlight: true });

    await renderDashboard();

    expect(screen.queryByText(en.dashboard.noGroups.title)).toBeNull();
    expect(screen.getByText(en.sync.syncing)).toBeTruthy();
  });

  it("reads the summary and approvals again on pull-to-refresh, beside the sync pull", async () => {
    fakeStore();
    await renderDashboard();

    await pullToRefresh();

    expect(pullStore).toHaveBeenCalledWith("refresh");
    expect(rereadDashboard).toHaveBeenCalledTimes(1);
  });

  it("installs the focus reread of the summary and approvals", async () => {
    fakeStore();

    await renderDashboard();

    expect(useRereadDashboardOnFocus).toHaveBeenCalled();
  });
});
