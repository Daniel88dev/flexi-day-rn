import { render, screen } from "@testing-library/react-native";

import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { TranslationProvider } from "@/i18n/use-translation";

describe("EmptyDashboard", () => {
  it("says why the dashboard is empty", async () => {
    await render(
      <TranslationProvider>
        <EmptyDashboard />
      </TranslationProvider>
    );
    expect(screen.getByText("Nothing to show yet")).toBeTruthy();
  });
});
