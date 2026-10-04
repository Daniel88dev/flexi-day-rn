import { fireEvent, render, screen } from "@testing-library/react-native";

import { OptionSheet } from "@/components/report/option-sheet";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const renderIn = (node: React.ReactElement) =>
  render(<TranslationProvider>{node}</TranslationProvider>);

describe("OptionSheet", () => {
  it("renders an All row and checks for several picks, and closes on Done", async () => {
    const onPick = jest.fn();
    const onClose = jest.fn();
    await renderIn(
      <OptionSheet
        testID="sheet"
        open
        onClose={onClose}
        title="Groups"
        allLabel="All groups"
        options={[{ value: "g-1", label: "One", hint: "2 people" }]}
        picked={["g-1"]}
        onPick={onPick}
      />
    );

    expect(screen.getByTestId("sheet-all")).toHaveProp("accessibilityState", { checked: false });
    expect(screen.getByTestId("sheet-g-1")).toHaveProp("accessibilityRole", "checkbox");
    expect(screen.getByTestId("sheet-g-1")).toHaveProp("accessibilityLabel", "One, 2 people");
    await fireEvent.press(screen.getByTestId("sheet-all"));
    expect(onPick).toHaveBeenCalledWith(null);
    await fireEvent.press(screen.getByTestId("sheet-done"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders radios and no All row for one pick", async () => {
    await renderIn(
      <OptionSheet
        testID="sheet"
        open
        onClose={jest.fn()}
        title="Period"
        options={[{ value: "rolling", label: "Last 12 months" }]}
        picked={["rolling"]}
        onPick={jest.fn()}
      />
    );

    expect(screen.queryByTestId("sheet-all")).toBeNull();
    expect(screen.getByTestId("sheet-rolling")).toHaveProp("accessibilityRole", "radio");
  });
});
