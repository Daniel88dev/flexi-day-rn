import { render, screen } from "@testing-library/react-native";

import { MoreSheet } from "@/components/shell/more-sheet";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { buildSections, buildUtilityLinks, splitForTabBar } from "@/lib/navigation/shell-links";

const sections = buildSections(en, { administersSomething: false });
const { sheet } = splitForTabBar(sections);

function renderSheet(open: boolean) {
  return render(
    <TranslationProvider>
      <MoreSheet
        open={open}
        onClose={jest.fn()}
        sections={sheet}
        utility={buildUtilityLinks(en)}
        viewer={{ name: "Dana Kučerová", email: "dana@northwind.co" }}
        onNavigate={jest.fn()}
        onSignOut={jest.fn()}
      />
    </TranslationProvider>
  );
}

describe("MoreSheet", () => {
  it("lists the destinations the bar has no slot for", async () => {
    await renderSheet(true);
    expect(screen.getByText("Report")).toBeTruthy();
    expect(screen.getByText("Groups")).toBeTruthy();
    expect(screen.getByText("Calendar sync")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("offers a way out and names the viewer", async () => {
    await renderSheet(true);
    expect(screen.getByText("Sign out")).toBeTruthy();
    expect(screen.getByText("Dana Kučerová")).toBeTruthy();
  });

  it("renders nothing while closed", async () => {
    await renderSheet(false);
    expect(screen.queryByText("Settings")).toBeNull();
  });
});
