import { ActionSheetIOS } from "react-native";

import type { GroupMember } from "@/lib/query";

/** Myself first, then the members; `null` books for the viewer. */
export function showMemberPicker(
  {
    title,
    members,
    myselfLabel,
    cancelLabel,
  }: {
    title: string;
    members: readonly GroupMember[];
    myselfLabel: string;
    cancelLabel: string;
  },
  onPick: (memberId: string | null) => void
): void {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      options: [myselfLabel, ...members.map((member) => member.user.name), cancelLabel],
      cancelButtonIndex: members.length + 1,
    },
    (index) => {
      if (index === 0) onPick(null);
      else if (index <= members.length) onPick(members[index - 1].userId);
    }
  );
}
