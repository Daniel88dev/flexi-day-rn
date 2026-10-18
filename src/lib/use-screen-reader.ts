import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Whether VoiceOver (or TalkBack) is running, following it as it turns on and off. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (live) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
