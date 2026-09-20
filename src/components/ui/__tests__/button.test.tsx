import { render, screen, userEvent } from "@testing-library/react-native";
import { ArrowRightIcon } from "phosphor-react-native";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its label", async () => {
    await render(<Button label="Sign in" icon={ArrowRightIcon} />);
    expect(screen.getByText("Sign in")).toBeTruthy();
  });

  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<Button label="Sign in" onPress={onPress} />);
    await userEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalled();
  });

  it("presses nothing while it is disabled", async () => {
    const onPress = jest.fn();
    await render(<Button label="Sign in" onPress={onPress} disabled />);
    await userEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("presses nothing while it is loading", async () => {
    const onPress = jest.fn();
    await render(<Button label="Signing in…" onPress={onPress} loading />);
    await userEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
