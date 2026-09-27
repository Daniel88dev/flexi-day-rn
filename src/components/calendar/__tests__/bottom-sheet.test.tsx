import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { BottomSheet } from "@/components/calendar/bottom-sheet";

describe("BottomSheet", () => {
  it("renders its content and closes from the dimmed screen", async () => {
    const onClose = jest.fn();
    await render(
      <BottomSheet open onClose={onClose} closeLabel="Cancel" testID="sheet">
        <Text>inside</Text>
      </BottomSheet>
    );

    expect(screen.getByText("inside")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("sheet-backdrop"));

    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while closed", async () => {
    await render(
      <BottomSheet open={false} onClose={jest.fn()} closeLabel="Cancel">
        <Text>inside</Text>
      </BottomSheet>
    );

    expect(screen.queryByText("inside")).toBeNull();
  });
});
