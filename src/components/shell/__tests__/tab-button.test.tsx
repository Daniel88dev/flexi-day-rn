import { render, screen, userEvent } from "@testing-library/react-native";

import { TabButton } from "@/components/shell/tab-button";
import { SquaresFourIcon } from "phosphor-react-native";

describe("TabButton", () => {
  it("renders its label", async () => {
    await render(<TabButton label="Dashboard" icon={SquaresFourIcon} />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("reports the focused tab as selected", async () => {
    await render(<TabButton label="Dashboard" icon={SquaresFourIcon} isFocused />);
    expect(screen.getByRole("tab", { selected: true })).toBeTruthy();
  });

  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<TabButton label="More" icon={SquaresFourIcon} onPress={onPress} />);
    await userEvent.press(screen.getByRole("tab"));
    expect(onPress).toHaveBeenCalled();
  });
});
