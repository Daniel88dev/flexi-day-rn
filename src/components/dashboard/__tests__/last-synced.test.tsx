import { render, screen } from "@testing-library/react-native";

import { LastSynced, relativeAge } from "@/components/dashboard/last-synced";
import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { useSyncStatus, type SyncStatus } from "@/lib/local-store";

jest.mock("@/lib/local-store", () => ({ useSyncStatus: jest.fn() }));

const status = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;

function fakeStatus(patch: Partial<SyncStatus> = {}) {
  status.mockReturnValue({
    inFlight: false,
    lastPulledAt: null,
    lastError: null,
    hasCursor: false,
    generation: 0,
    ...patch,
  });
}

function renderLine() {
  return render(
    <TranslationProvider>
      <LastSynced />
    </TranslationProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("relativeAge", () => {
  it("returns the roughest unit that still says something", () => {
    expect(relativeAge(12_000, en)).toBe("just now");
    expect(relativeAge(5 * 60_000, en)).toBe("5 min ago");
    expect(relativeAge(3 * 60 * 60_000, en)).toBe("3 h ago");
    expect(relativeAge(50 * 60 * 60_000, en)).toBe("2 d ago");
  });

  it("returns the dictionary it is given, so Czech reads as Czech", () => {
    expect(relativeAge(5 * 60_000, cs)).toBe("před 5 min");
  });
});

describe("LastSynced", () => {
  it("renders how long ago the last pull finished", async () => {
    fakeStatus({ lastPulledAt: new Date(Date.now() - 5 * 60_000).toISOString() });

    await renderLine();

    expect(screen.getByText("Last synced 5 min ago")).toBeTruthy();
  });

  it("renders that nothing has synced yet before the first pull", async () => {
    fakeStatus();

    await renderLine();

    expect(screen.getByText("Not synced yet")).toBeTruthy();
  });
});
