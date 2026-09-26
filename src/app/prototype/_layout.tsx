// PROTOTYPE (T-35): a stack for throwaway routes, so the clock sheet can be a real formSheet.
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";

export default function PrototypeLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="clock-sheet-open"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
      </Stack>
      <Toaster />
    </GestureHandlerRootView>
  );
}
