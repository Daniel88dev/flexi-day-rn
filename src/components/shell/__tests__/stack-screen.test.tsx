import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Pressable, Text } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

type Props = Parameters<typeof StackScreen>[0];

async function renderScreen(props: Partial<Props> = {}) {
  await render(
    <TranslationProvider>
      <StackScreen testID="screen" {...({ title: "Groups", ...props } as Props)} />
    </TranslationProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe("StackScreen", () => {
  it("shows its title in the bar and goes back from the back button named by it", async () => {
    await renderScreen();

    expect(screen.getByText("Groups")).toBeOnTheScreen();
    expect(screen.getByTestId("stack-back")).toHaveAccessibleName("Groups");
    await fireEvent.press(screen.getByTestId("stack-back"));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("leaves the title out of the bar and keeps it as the back button's name", async () => {
    await renderScreen({ hideTitle: true });

    expect(screen.queryByText("Groups")).toBeNull();
    expect(screen.getByTestId("stack-back")).toHaveAccessibleName("Groups");
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
    expect(back).toHaveAccessibleName("Report");
    expect(back).toHaveTextContent("Report");
    expect(screen.getAllByText("Report")).toHaveLength(1);

    await fireEvent.press(back);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("puts a trailing action in the bar", async () => {
    const onPress = jest.fn();
    await renderScreen({
      trailing: (
        <Pressable testID="trailing-action" onPress={onPress}>
          <Text>Join</Text>
        </Pressable>
      ),
    });

    await fireEvent.press(screen.getByTestId("trailing-action"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a coming-soon line without children", async () => {
    await renderScreen();

    expect(screen.getByText("Groups lands here.")).toBeOnTheScreen();
  });
});
