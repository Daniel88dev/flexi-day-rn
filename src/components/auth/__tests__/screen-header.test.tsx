import { render, screen, userEvent } from "@testing-library/react-native";

import { ScreenHeader } from "@/components/auth/screen-header";

describe("ScreenHeader", () => {
  it("calls onBack when the back button is tapped", async () => {
    const onBack = jest.fn();

    await render(<ScreenHeader onBack={onBack} backLabel="Back" />);

    await userEvent.press(screen.getByLabelText("Back"));

    expect(onBack).toHaveBeenCalled();
  });

  it("carries the auth-back id on the back button", async () => {
    await render(<ScreenHeader onBack={jest.fn()} backLabel="Back" />);

    expect(screen.getByTestId("auth-back")).toHaveAccessibleName("Back");
  });
});
