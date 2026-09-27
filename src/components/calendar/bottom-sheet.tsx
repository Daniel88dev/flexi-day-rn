import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";

export function BottomSheet({
  open,
  onClose,
  closeLabel,
  testID,
  children,
}: {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          testID={testID ? `${testID}-backdrop` : undefined}
          accessibilityLabel={closeLabel}
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.38)" }}
          onPress={onClose}
        />
        <View testID={testID} className="max-h-[75%] rounded-t-[28px] bg-card pt-2.5 pb-safe">
          <View aria-hidden className="mx-auto mb-2 h-1 w-9 rounded-full bg-border" />
          {children}
        </View>
      </View>
    </Modal>
  );
}
