import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { StackScreen } from "@/components/shell/stack-screen";
import { Text } from "@/components/ui/text";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

describe("StackScreen", () => {
  it("renders the title beside a back button named after it", async () => {
    await render(
      <TranslationProvider>
        <StackScreen title="Settings">
          <Text>Body</Text>
        </StackScreen>
      </TranslationProvider>
    );

    expect(screen.getByText("Settings")).toBeOnTheScreen();
    expect(screen.getByTestId("stack-back")).toHaveProp("accessibilityLabel", "Settings");
    expect(screen.getByText("Body")).toBeOnTheScreen();
  });

  it("renders the back label inside the back button and no title", async () => {
    await render(
      <TranslationProvider>
        <StackScreen backLabel="Report">
          <Text>Body</Text>
        </StackScreen>
      </TranslationProvider>
    );

    const back = screen.getByTestId("stack-back");
    expect(back).toHaveProp("accessibilityLabel", "Report");
    expect(back).toHaveTextContent("Report");
    expect(screen.getAllByText("Report")).toHaveLength(1);

    await fireEvent.press(back);
    expect(router.back).toHaveBeenCalled();
  });
});
