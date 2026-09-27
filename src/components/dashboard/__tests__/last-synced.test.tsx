import { render, screen } from "@testing-library/react-native";

import { LastSynced } from "@/components/dashboard/last-synced";
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
