import { fireEvent, render, screen } from "@testing-library/react-native";

import { LeaveTypeTabs } from "@/components/report/leave-type-tabs";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

describe("LeaveTypeTabs", () => {
  it("renders one tab per type, the picked one selected", async () => {
    await render(
      <TranslationProvider>
        <LeaveTypeTabs
          types={["VACATION", "HOME_OFFICE"]}
          value="HOME_OFFICE"
          onChange={jest.fn()}
        />
      </TranslationProvider>
    );

    expect(screen.getByTestId("report-type-VACATION")).toHaveProp("accessibilityState", {
      selected: false,
    });
    expect(screen.getByTestId("report-type-HOME_OFFICE")).toHaveProp("accessibilityState", {
      selected: true,
    });
    expect(screen.getByTestId("report-type-HOME_OFFICE")).toHaveProp("accessibilityRole", "tab");
    expect(screen.getByText("Home Office")).toBeOnTheScreen();
  });

  it("calls back with the type tapped", async () => {
    const onChange = jest.fn();
    await render(
      <TranslationProvider>
        <LeaveTypeTabs types={["VACATION", "SICK_DAY"]} value="VACATION" onChange={onChange} />
      </TranslationProvider>
    );

    await fireEvent.press(screen.getByTestId("report-type-SICK_DAY"));

    expect(onChange).toHaveBeenCalledWith("SICK_DAY");
  });

  it("renders nothing with a single type", async () => {
    await render(
      <TranslationProvider>
        <LeaveTypeTabs types={["VACATION"]} value="VACATION" onChange={jest.fn()} />
      </TranslationProvider>
    );

    expect(screen.queryByTestId("report-type-VACATION")).toBeNull();
  });
});
