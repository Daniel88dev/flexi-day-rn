import { render, screen, userEvent } from "@testing-library/react-native";
import { StyleSheet, useColorScheme } from "react-native";

import { ProviderButton } from "@/components/auth/provider-button";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(() => "light"),
}));

const colorScheme = useColorScheme as jest.Mock;

function backgroundOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style)?.backgroundColor;
}

beforeEach(() => {
  colorScheme.mockReturnValue("light");
});

describe("ProviderButton", () => {
  it.each(["apple", "google", "microsoft"] as const)(
    "renders the %s label and answers its press",
    async (provider) => {
      const onPress = jest.fn();
      await render(
        <ProviderButton
          testID={`sign-in-${provider}`}
          provider={provider}
          label={`Sign in with ${provider}`}
          onPress={onPress}
        />
      );

      expect(screen.getByText(`Sign in with ${provider}`)).toBeTruthy();
      await userEvent.press(screen.getByTestId(`sign-in-${provider}`));
      expect(onPress).toHaveBeenCalled();
    }
  );

  it("paints Apple's button black in light mode", async () => {
    await render(<ProviderButton testID="sign-in-apple" provider="apple" label="Apple" />);

    expect(backgroundOf("sign-in-apple")).toBe("#000000");
  });

  it("paints Apple's button white in dark mode", async () => {
    colorScheme.mockReturnValue("dark");

    await render(<ProviderButton testID="sign-in-apple" provider="apple" label="Apple" />);

    expect(backgroundOf("sign-in-apple")).toBe("#ffffff");
  });

  it("presses nothing while it is disabled", async () => {
    const onPress = jest.fn();
    await render(
      <ProviderButton
        testID="sign-in-google"
        provider="google"
        label="Google"
        disabled
        onPress={onPress}
      />
    );

    await userEvent.press(screen.getByTestId("sign-in-google"));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId("sign-in-google")).toBeDisabled();
  });

  it("presses nothing while its own request is in flight", async () => {
    const onPress = jest.fn();
    await render(
      <ProviderButton
        testID="sign-in-microsoft"
        provider="microsoft"
        label="Microsoft"
        loading
        onPress={onPress}
      />
    );

    await userEvent.press(screen.getByTestId("sign-in-microsoft"));

    expect(onPress).not.toHaveBeenCalled();
  });
});
