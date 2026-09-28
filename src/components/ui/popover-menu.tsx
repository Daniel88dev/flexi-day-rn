import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useRef } from "react";
import { Modal, Platform, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type PopoverMenuItem = {
  key: string;
  label: string;
  icon: PhosphorIcon;
  onSelect: () => void;
  destructive?: boolean;
};

/**
 * A menu card dropped below a header button, closed by a tap anywhere else. `top` is the gap from
 * the safe area to the card. The chosen item runs once the menu has finished closing: iOS drops an
 * alert or a second modal that opens while this one is still animating out.
 */
export function PopoverMenu({
  open,
  onClose,
  items,
  top,
  closeLabel,
  testID,
}: {
  open: boolean;
  onClose: () => void;
  items: PopoverMenuItem[];
  top: number;
  closeLabel: string;
  testID?: string;
}) {
  const chosenRef = useRef<PopoverMenuItem | null>(null);

  const runChosen = () => {
    const item = chosenRef.current;
    chosenRef.current = null;
    item?.onSelect();
  };

  const choose = (item: PopoverMenuItem) => {
    chosenRef.current = item;
    onClose();
    if (Platform.OS !== "ios") runChosen();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={runChosen}
    >
      <View className="flex-1 pt-safe">
        <Pressable
          testID={testID ? `${testID}-backdrop` : undefined}
          accessibilityLabel={closeLabel}
          className="absolute inset-0"
          onPress={onClose}
        />
        <View
          testID={testID}
          accessibilityRole="menu"
          style={{ marginTop: top }}
          className="mr-3 w-[240px] self-end overflow-hidden rounded-[24px] border border-border bg-card py-1.5 shadow-lg"
        >
          {items.map((item) => (
            <Pressable
              key={item.key}
              testID={testID ? `${testID}-${item.key}` : undefined}
              onPress={() => choose(item)}
              accessibilityRole="menuitem"
              className="h-12 flex-row items-center gap-3 px-4 active:bg-muted"
            >
              <Icon icon={item.icon} tone={item.destructive ? "danger" : "foreground"} />
              <Text
                className={cn(
                  "text-[16px] font-medium",
                  item.destructive ? "text-danger" : "text-foreground"
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
