import { useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, View, type AppStateStatus } from "react-native";
import { FullWindowOverlay } from "react-native-screens";

import { LogoMark, Wordmark } from "@/components/ui/logo";
import { usePrivacyCoverHeld } from "@/lib/privacy-cover";

const covered = (state: AppStateStatus | null) => state === "inactive" || state === "background";

/**
 * A plain Flexi Day screen over everything while the app is not active and something sensitive
 * is open, because iOS writes the app-switcher snapshot to disk. It mounts only when it covers:
 * the overlay window then sits above any sheet presented before it.
 */
export function PrivacyCover() {
  const held = usePrivacyCoverHeld();
  const [state, setState] = useState<AppStateStatus | null>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setState);
    return () => subscription.remove();
  }, []);

  if (!held || !covered(state)) return null;

  const cover = (
    <View
      testID="privacy-cover"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      className="items-center justify-center gap-3 bg-background"
    >
      <LogoMark size={56} />
      <Wordmark size={44} />
    </View>
  );
  return Platform.OS === "ios" ? <FullWindowOverlay>{cover}</FullWindowOverlay> : cover;
}
