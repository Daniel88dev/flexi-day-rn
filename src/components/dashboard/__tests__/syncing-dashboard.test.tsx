import { render, screen } from "@testing-library/react-native";

import { SyncingDashboard } from "@/components/dashboard/syncing-dashboard";
import { TranslationProvider } from "@/i18n/use-translation";

describe("SyncingDashboard", () => {
  it("renders the card the first pull shows in place of the empty one", async () => {
    await render(
      <TranslationProvider>
        <SyncingDashboard />
      </TranslationProvider>
    );

    expect(screen.getByText("Syncing…")).toBeTruthy();
  });
});
