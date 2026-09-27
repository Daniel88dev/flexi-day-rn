import { Alert } from "react-native";

/**
 * A native confirmation with an optional reason. Answers the reason, trimmed, `undefined` for
 * none, or `null` when the person backed out.
 */
export function askForReason({
  title,
  message,
  confirmLabel,
  cancelLabel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}): Promise<string | undefined | null> {
  return new Promise((resolve) => {
    Alert.prompt(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(null) },
        {
          text: confirmLabel,
          style: "destructive",
          onPress: (reason?: string) => resolve(reason?.trim() || undefined),
        },
      ],
      "plain-text"
    );
  });
}
