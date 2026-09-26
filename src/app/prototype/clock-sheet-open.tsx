// PROTOTYPE (T-35): the clock sheet itself, presented as an Expo Router formSheet.
import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { toast } from "sonner-native";

import { retry, set, useProto } from "@/prototype/clock-sheet/model";
import { ClockSheetBody, HapticFlash, useVar } from "@/prototype/clock-sheet/ui";

export default function ClockSheetOpen() {
  const s = useProto();
  const card = useVar("--card", "#fffdfa");

  useEffect(() => {
    if (!s.error || s.prefs.errors !== "toast") return;
    const retryable = s.error.retry;
    toast.error(s.error.title, {
      description: s.error.body,
      action: retryable ? { label: "Retry", onClick: () => retry() } : undefined,
    });
  }, [s.error, s.prefs.errors]);

  const onLink = (to: string) => {
    set({ lastAction: `→ ${to}` });
    router.back();
  };

  return (
    <View className="bg-card px-5 pt-7 pb-safe">
      <Stack.Screen
        options={{
          sheetAllowedDetents: s.prefs.variant === "B" ? [0.62, 0.95] : "fitToContents",
          contentStyle: { backgroundColor: card },
        }}
      />
      <View className="pb-4">
        <ClockSheetBody onLink={onLink} />
      </View>
      <HapticFlash />
    </View>
  );
}
