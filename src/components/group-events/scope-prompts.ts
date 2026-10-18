import { ActionSheetIOS, Alert } from "react-native";

import type { Dictionary } from "@/i18n/en";
import type { GroupEventScope } from "@/lib/group-events/draft";

const SCOPES: readonly GroupEventScope[] = ["this", "following", "all"];

function scopeSheet(
  options: { title: string; message: string; destructive: boolean; disabled: number[] },
  t: Dictionary
): Promise<GroupEventScope | null> {
  const labels = t.groupEvents.scope;
  return new Promise((resolve) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: options.title,
        message: options.message,
        options: [labels.thisEvent, labels.following, labels.all, labels.cancel],
        cancelButtonIndex: SCOPES.length,
        destructiveButtonIndex: options.destructive ? [0, 1, 2] : undefined,
        disabledButtonIndices: options.disabled.length > 0 ? options.disabled : undefined,
      },
      (index) => resolve(SCOPES[index] ?? null)
    )
  );
}

/** Which dates a recurring save applies to; a changed rule can't apply to one date. */
export function askEditScope(
  { title, ruleChanged }: { title: string; ruleChanged: boolean },
  t: Dictionary
): Promise<GroupEventScope | null> {
  const labels = t.groupEvents.scope;
  return scopeSheet(
    {
      title: labels.changeTitle(title),
      message: ruleChanged ? labels.ruleOnOneDate : labels.changeQuestion,
      destructive: false,
      disabled: ruleChanged ? [0] : [],
    },
    t
  );
}

/** The warning before an edit drops one-off changes, with their count. */
export function confirmDropped(
  { title, dropped }: { title: string; dropped: number },
  t: Dictionary
): Promise<boolean> {
  const labels = t.groupEvents.scope;
  return new Promise((resolve) =>
    Alert.alert(labels.changeTitle(title), labels.dropped(dropped), [
      { text: labels.cancel, style: "cancel", onPress: () => resolve(false) },
      { text: labels.save, onPress: () => resolve(true) },
    ])
  );
}

/**
 * A recurring group event asks which dates go, a one-off a plain confirm. Both say it leaves
 * every calendar with no undo. Null when the person backs out.
 */
export function askDelete(
  { title, recurring }: { title: string; recurring: boolean },
  t: Dictionary
): Promise<{ scope?: GroupEventScope } | null> {
  const labels = t.groupEvents.scope;
  if (recurring) {
    return scopeSheet(
      {
        title: labels.deleteTitle(title),
        message: labels.deleteBody,
        destructive: true,
        disabled: [],
      },
      t
    ).then((scope) => (scope ? { scope } : null));
  }
  return new Promise((resolve) =>
    Alert.alert(labels.deleteTitle(title), labels.deleteBody, [
      { text: labels.cancel, style: "cancel", onPress: () => resolve(null) },
      { text: labels.deleteConfirm, style: "destructive", onPress: () => resolve({}) },
    ])
  );
}
