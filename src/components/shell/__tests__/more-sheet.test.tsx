import { fireEvent, render, screen } from "@testing-library/react-native";

import { MoreSheet } from "@/components/shell/more-sheet";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { buildSections, buildUtilityLinks, splitForTabBar } from "@/lib/navigation/shell-links";
import { VIEWER } from "@/test-support/session";

const sections = buildSections(en);
const { sheet } = splitForTabBar(sections);

function renderSheet(open: boolean, onClose: () => void = jest.fn()) {
  return render(
    <TranslationProvider>
      <MoreSheet
        open={open}
        onClose={onClose}
        sections={sheet}
        utility={buildUtilityLinks(en)}
        viewer={VIEWER}
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

  it("shows none of the admin links, whose pages the phone does not have", async () => {
    await renderSheet(true);
    expect(screen.queryByText("Team attendance")).toBeNull();
    expect(screen.queryByText("Organization")).toBeNull();
    expect(screen.queryByText("Billing")).toBeNull();
  });

  it("offers a way out and names the viewer", async () => {
    await renderSheet(true);
    expect(screen.getByText("Sign out")).toBeTruthy();
    expect(screen.getByText(VIEWER.name)).toBeTruthy();
  });

  it("gives every row, sign-out and the backdrop a testID on its pressable", async () => {
    await renderSheet(true);
    for (const link of [...sheet.flatMap((section) => section.links), ...buildUtilityLinks(en)]) {
      expect(screen.getByTestId(`more-${link.key}`)).toHaveTextContent(link.label);
    }
    expect(screen.getByTestId("more-settings")).toBeTruthy();
    expect(screen.getByTestId("more-sign-out")).toHaveTextContent("Sign out");
    expect(screen.getByTestId("more-close")).toBeTruthy();
  });

  it("closes from the backdrop", async () => {
    const onClose = jest.fn();
    await renderSheet(true, onClose);

    await fireEvent.press(screen.getByTestId("more-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed", async () => {
    await renderSheet(false);
    expect(screen.queryByText("Settings")).toBeNull();
  });
});
