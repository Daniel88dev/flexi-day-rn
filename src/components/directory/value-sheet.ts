import * as Clipboard from "expo-clipboard";
import { ActionSheetIOS, Linking } from "react-native";
import { toast } from "sonner-native";

import type { Dictionary } from "@/i18n";
import { valueActions, type ProfileValue, type ValueAction } from "@/lib/directory";
import { haptic } from "@/lib/haptics";

async function run(action: ValueAction, t: Dictionary) {
  if (action.kind !== "copy") {
    await Linking.openURL(action.url);
    return;
  }
  try {
    await Clipboard.setStringAsync(action.text);
    haptic("success");
    toast.success(t.directory.profile.copied);
  } catch (cause: unknown) {
    console.error("Copying to the clipboard failed.", cause);
    toast.error(t.directory.profile.copyFailed);
  }
}

/** The action sheet a tapped phone or email value opens, titled with the value itself. */
export function showValueSheet(value: ProfileValue, t: Dictionary): void {
  const copy = t.directory.profile;
  const actions = valueActions(value);
  const label = (action: ValueAction) =>
    action.kind === "call" ? copy.call : action.kind === "email" ? copy.email : copy.copy;
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: value.kind === "phone" ? value.phone.display : value.email,
      options: [...actions.map(label), copy.cancel],
      cancelButtonIndex: actions.length,
    },
    (index) => {
      const action = actions[index];
      if (action) void run(action, t).catch((cause: unknown) => console.error(cause));
    }
  );
}
