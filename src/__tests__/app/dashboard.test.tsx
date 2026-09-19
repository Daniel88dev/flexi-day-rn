import { act, render, screen } from "@testing-library/react-native";
import { toast } from "sonner-native";

import DashboardScreen from "@/app/(app)/dashboard";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  pull,
  useStoreRowCounts,
  useSyncStatus,
  type PullOutcome,
  type SyncStatus,
  type SyncTableName,
} from "@/lib/local-store";

jest.mock("@/lib/local-store", () => ({
  pull: jest.fn(),
  useStoreRowCounts: jest.fn(),
  useSyncStatus: jest.fn(),
}));

jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));

jest.mock("@/components/dashboard/development-card", () => ({ DevelopmentCard: () => null }));

const pullStore = pull as jest.MockedFunction<typeof pull>;
const rowCounts = useStoreRowCounts as jest.MockedFunction<typeof useStoreRowCounts>;
const status = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;
const toastError = toast.error as jest.MockedFunction<typeof toast.error>;

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
});
