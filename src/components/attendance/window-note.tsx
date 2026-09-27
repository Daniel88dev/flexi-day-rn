import { LockSimpleIcon } from "phosphor-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { windowNoteText, type WindowNote as Note } from "@/lib/attendance";

/** The foot of the Day view: what the Self-service window lets the reader do with this day. */
export function WindowNote({ note }: { note: Note }) {
  const { t } = useTranslation();
  const text = windowNoteText(note, t);

  if (note.kind === "hint") {
    return (
      <Text testID="window-hint" className="px-1 text-[13px] leading-[18px] text-muted-foreground">
        {text}
      </Text>
    );
  }

  // Off is the organization's standing choice rather than news about this day, so it stays quiet.
  if (note.cause === "OFF") {
    return (
      <View testID="window-off" className="flex-row gap-2 px-1">
        <View className="pt-0.5">
          <Icon icon={LockSimpleIcon} tone="faint" size={13} weight="bold" />
        </View>
        <Text className="flex-1 text-[12.5px] leading-[17px] text-muted-foreground">{text}</Text>
      </View>
    );
  }

  return (
    <View testID="window-lock" className="flex-row gap-3 rounded-[16px] bg-muted p-3.5">
      <View className="pt-0.5">
        <Icon icon={LockSimpleIcon} tone="muted" size={16} weight="bold" />
      </View>
      <Text className="flex-1 text-[13.5px] leading-[19px] text-foreground">{text}</Text>
    </View>
  );
}
