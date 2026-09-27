import { ActionSheetIOS } from "react-native";

import type { MemberGroup, RequestListScope } from "@/lib/local-store";

export function showGroupPicker(
  {
    title,
    groups,
    cancelLabel,
    mineLabel,
  }: {
    title: string;
    groups: readonly MemberGroup[];
    cancelLabel: string;
    mineLabel?: string;
  },
  onPick: (scope: RequestListScope) => void
): void {
  const extra = mineLabel === undefined ? [] : [mineLabel];
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      options: [...groups.map((group) => group.groupName), ...extra, cancelLabel],
      cancelButtonIndex: groups.length + extra.length,
    },
    (index) => {
      if (index < groups.length) onPick({ kind: "group", groupId: groups[index].groupId });
      else if (mineLabel !== undefined && index === groups.length) onPick({ kind: "mine" });
    }
  );
}
