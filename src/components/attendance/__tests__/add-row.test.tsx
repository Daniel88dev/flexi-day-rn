import { fireEvent, render, screen } from "@testing-library/react-native";

import { AddRow } from "@/components/attendance/add-row";

describe("AddRow", () => {
  it("renders its label as a button and presses through", async () => {
    const onPress = jest.fn();
    await render(<AddRow testID="add" label="Add break" onPress={onPress} />);

    expect(screen.getByRole("button")).toHaveTextContent("Add break");
    await fireEvent.press(screen.getByTestId("add"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
