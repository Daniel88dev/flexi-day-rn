import { FilePdfIcon, ImageIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { isImage } from "@/lib/requests/attachments";

export function AttachmentRow({
  testID,
  contentType,
  name,
  meta,
  note,
  noteTone = "faint",
  progress,
  onPress,
  pressLabel,
  trailing,
}: {
  testID?: string;
  contentType: string;
  name: string;
  meta: string;
  note?: string | null;
  noteTone?: "faint" | "danger";
  progress?: number;
  onPress?: () => void;
  pressLabel?: string;
  trailing?: ReactNode;
}) {
  const percent = progress === undefined ? null : Math.round(progress * 100);
  const body = (
    <>
      <View className="h-9 w-9 items-center justify-center rounded-[16px] bg-muted">
        <Icon icon={isImage(contentType) ? ImageIcon : FilePdfIcon} tone="muted" size={18} />
      </View>
      <View className="flex-1">
        <Text
          className={cn(
            "text-[15px] font-semibold",
            onPress ? "text-foreground" : "text-muted-foreground"
          )}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text className="text-[12.5px] text-faint" numberOfLines={1}>
          {meta}
        </Text>
        {note ? (
          <Text
            className={cn(
              "mt-0.5 text-[12.5px] leading-[17px]",
              noteTone === "danger" ? "text-danger" : "text-faint"
            )}
          >
            {note}
          </Text>
        ) : null}
        {percent !== null ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={name}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          >
            <View className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View testID={testID} className="flex-row items-center gap-1 pr-2">
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={pressLabel}
          className="flex-1 flex-row items-start gap-3 py-3 pl-4 active:opacity-60"
        >
          {body}
        </Pressable>
      ) : (
        <View className="flex-1 flex-row items-start gap-3 py-3 pl-4">{body}</View>
      )}
      {trailing}
    </View>
  );
}

export function RowAction({
  testID,
  label,
  icon,
  tone = "faint",
  onPress,
  disabled,
}: {
  testID?: string;
  label: string;
  icon: Parameters<typeof Icon>[0]["icon"];
  tone?: "faint" | "danger";
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      className={cn(
        "h-10 w-10 items-center justify-center rounded-full active:bg-muted",
        disabled && "opacity-40"
      )}
    >
      <Icon icon={icon} tone={tone} size={18} />
    </Pressable>
  );
}
