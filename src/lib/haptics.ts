import * as Haptics from "expo-haptics";

export type HapticKind = "tap" | "selection" | "success" | "warning" | "error";

const FEEDBACK = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
} as const;

/** Fire and forget: a phone without a Taptic Engine says no, and nothing depends on it. */
export function haptic(kind: HapticKind): void {
  const played =
    kind === "tap"
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      : kind === "selection"
        ? Haptics.selectionAsync()
        : Haptics.notificationAsync(FEEDBACK[kind]);
  played.catch(() => undefined);
}
