import { fireEvent, render, screen } from "@testing-library/react-native";

import { FilterChip } from "@/components/report/filter-chip";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const renderIn = (node: React.ReactElement) =>
  render(<TranslationProvider>{node}</TranslationProvider>);

describe("FilterChip", () => {
  it("renders its choice and reads its name with it", async () => {
    const onPress = jest.fn();
    await renderIn(
      <FilterChip testID="chip" name="Groups" label="Dev Team" active onPress={onPress} />
    );

    expect(screen.getByText("Dev Team")).toBeOnTheScreen();
    expect(screen.getByTestId("chip")).toHaveProp("accessibilityLabel", "Groups, Dev Team");
    await fireEvent.press(screen.getByTestId("chip"));
    expect(onPress).toHaveBeenCalled();
  });
});
