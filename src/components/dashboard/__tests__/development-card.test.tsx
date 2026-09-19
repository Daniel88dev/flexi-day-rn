import { render, screen } from "@testing-library/react-native";

import { DevelopmentCard, formatAge } from "@/components/dashboard/development-card";
import { useStoreRowCounts, useSyncStatus, type SyncStatus } from "@/lib/local-store";

jest.mock("@/lib/local-store", () => ({
  useStoreRowCounts: jest.fn(),
  useSyncStatus: jest.fn(),
}));

/** `__DEV__` is a bundler global, so a test flips it through the object it lives on. */
const runtimeGlobals = globalThis as unknown as { __DEV__: boolean };

const status = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;
const rowCounts = useStoreRowCounts as jest.MockedFunction<typeof useStoreRowCounts>;

const COUNTS = {
  organizations: 1,
  users: 2,
  groups: 3,
  groupUsers: 4,
  groupMirrors: 5,
  userYearQuotas: 6,
  bankHolidays: 7,
  vacations: 8,
};

beforeEach(() => {
  jest.clearAllMocks();
});

function fakeStore(patch: Partial<SyncStatus> = {}) {
  status.mockReturnValue({
    inFlight: false,
    lastPulledAt: new Date(Date.now() - 90_000).toISOString(),
    lastError: null,
    hasCursor: true,
    generation: 3,
    ...patch,
  });
  rowCounts.mockReturnValue(COUNTS);
}

describe("formatAge", () => {
  it("returns the roughest unit that still says something", () => {
    expect(formatAge(12_000)).toBe("12s");
    expect(formatAge(90_000)).toBe("1m");
    expect(formatAge(3 * 60 * 60_000)).toBe("3h");
    expect(formatAge(50 * 60 * 60_000)).toBe("2d");
  });
});

describe("DevelopmentCard", () => {
  it("renders a row count for every table of the pull", async () => {
    fakeStore();

    await render(<DevelopmentCard />);

    expect(screen.getByText("vacations")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("organizations")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders the cursor's age and the generation", async () => {
    fakeStore();

    await render(<DevelopmentCard />);

    expect(screen.getByText("Cursor 1m old · generation 3")).toBeTruthy();
    expect(screen.getByText("Last pull 1m ago")).toBeTruthy();
  });

  it("renders no cursor age before the first pull", async () => {
    fakeStore({ lastPulledAt: null, hasCursor: false, generation: 0 });

    await render(<DevelopmentCard />);

    expect(screen.getByText("Cursor none · generation 0")).toBeTruthy();
    expect(screen.getByText("Never pulled")).toBeTruthy();
  });

  it("renders the last error", async () => {
    fakeStore({ lastError: "The sync pull timed out." });

    await render(<DevelopmentCard />);

    expect(screen.getByText("Error: The sync pull timed out.")).toBeTruthy();
  });

  it("renders that a pull is running", async () => {
    fakeStore({ inFlight: true });

    await render(<DevelopmentCard />);

    expect(screen.getByText("Syncing…")).toBeTruthy();
  });

  it("renders nothing outside a development build", async () => {
    fakeStore();
    const development = runtimeGlobals.__DEV__;
    runtimeGlobals.__DEV__ = false;

    try {
      const { toJSON } = await render(<DevelopmentCard />);

      expect(toJSON()).toBeNull();
      expect(status).not.toHaveBeenCalled();
    } finally {
      runtimeGlobals.__DEV__ = development;
    }
  });
});
