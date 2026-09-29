import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("centres itself on its row over RN's flex-start default", async () => {
    await render(<Switch testID="switch" value={false} />);

    expect(StyleSheet.flatten(screen.getByTestId("switch").props.style).alignSelf).toBe("center");
  });

  it("keeps a style the caller passes", async () => {
    await render(<Switch testID="switch" value={false} style={{ opacity: 0.5 }} />);

    expect(StyleSheet.flatten(screen.getByTestId("switch").props.style)).toMatchObject({
      alignSelf: "center",
      opacity: 0.5,
    });
  });

  it("answers the change", async () => {
    const onValueChange = jest.fn();
    await render(<Switch testID="switch" value={false} onValueChange={onValueChange} />);

    await fireEvent(screen.getByTestId("switch"), "valueChange", true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});
