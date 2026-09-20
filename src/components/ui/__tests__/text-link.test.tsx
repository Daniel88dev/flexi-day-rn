import { render, screen, userEvent } from "@testing-library/react-native";

import { TextLink } from "@/components/ui/text-link";

describe("TextLink", () => {
  it("renders its label", async () => {
    await render(<TextLink label="Create an account on the web" external />);
    expect(screen.getByText("Create an account on the web")).toBeTruthy();
  });

  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<TextLink label="Forgot password?" onPress={onPress} />);
    await userEvent.press(screen.getByRole("link"));
    expect(onPress).toHaveBeenCalled();
  });

  it("stays quiet while it is disabled", async () => {
    const onPress = jest.fn();
    await render(<TextLink label="Resend code (30)" onPress={onPress} disabled />);
    await userEvent.press(screen.getByRole("link"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
