import { fireEvent, render, screen } from "@testing-library/react-native";
import { PencilSimpleIcon, XCircleIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import { PopoverMenu, type PopoverMenuItem } from "@/components/ui/popover-menu";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

function Harness({ items }: { items: PopoverMenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID="trigger" onPress={() => setOpen(true)}>
        <Text>Options</Text>
      </Pressable>
      <PopoverMenu
        testID="menu"
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        top={52}
        closeLabel="Close"
      />
    </>
  );
}

const itemsWith = (onEdit: () => void, onCancel: () => void): PopoverMenuItem[] => [
  { key: "edit", label: "Edit", icon: PencilSimpleIcon, onSelect: onEdit },
  {
    key: "cancel",
    label: "Cancel request",
    icon: XCircleIcon,
    onSelect: onCancel,
    destructive: true,
  },
];

describe("PopoverMenu", () => {
  it("renders nothing until opened, then every item in order", async () => {
    await render(<Harness items={itemsWith(jest.fn(), jest.fn())} />);

    expect(screen.queryByTestId("menu")).toBeNull();

    await fireEvent.press(screen.getByTestId("trigger"));

    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByTestId("menu-edit")).toHaveTextContent("Edit");
    expect(screen.getByTestId("menu-cancel")).toHaveTextContent("Cancel request");
  });

  it("closes, then runs the chosen item and no other", async () => {
    const onEdit = jest.fn();
    const onCancel = jest.fn();
    await render(<Harness items={itemsWith(onEdit, onCancel)} />);

    await fireEvent.press(screen.getByTestId("trigger"));
    await fireEvent.press(screen.getByTestId("menu-cancel"));

    expect(screen.queryByTestId("menu")).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("closes on a tap outside without running anything", async () => {
    const onEdit = jest.fn();
    const onCancel = jest.fn();
    await render(<Harness items={itemsWith(onEdit, onCancel)} />);

    await fireEvent.press(screen.getByTestId("trigger"));
    await fireEvent.press(screen.getByTestId("menu-backdrop"));

    expect(screen.queryByTestId("menu")).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
