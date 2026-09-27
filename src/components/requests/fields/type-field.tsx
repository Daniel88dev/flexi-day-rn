import { CheckIcon } from "phosphor-react-native";
import { Fragment } from "react";
import { Pressable, View } from "react-native";

import { FieldLabel } from "@/components/requests/fields/field-label";
import { Icon } from "@/components/ui/icon";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { requestableTypes, type RequestableType } from "@/lib/requests/edit";

export function TypeField({
  value,
  onChange,
  offerSickDay,
  current,
}: {
  value: RequestableType | null;
  onChange: (type: RequestableType) => void;
  offerSickDay: boolean;
  /** The request's own type, kept on offer even when the list no longer carries it. */
  current?: RequestableType;
}) {
  const { t } = useTranslation();
  const { primary, others } = requestableTypes({ offerSickDay, current });

  const row = (type: RequestableType, index: number) => {
    const selected = type === value;
    return (
      <Fragment key={type}>
        {index > 0 ? <View className="ml-[42px] h-px bg-border" /> : null}
        <Pressable
          testID={`type-field-${type}`}
          onPress={() => onChange(type)}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          className="min-h-[48px] flex-row items-center gap-3 px-4 active:opacity-70"
        >
          <View className={cn("h-[11px] w-[11px] rounded-full", LEAVE_CLASSES[type].fill)} />
          <Text
            className={cn(
              "flex-1 text-[15.5px]",
              selected ? "font-semibold text-foreground" : "text-foreground"
            )}
          >
            {t.recordTypes[type]}
          </Text>
          {selected ? <Icon icon={CheckIcon} tone="primary" size={18} weight="bold" /> : null}
        </Pressable>
      </Fragment>
    );
  };

  return (
    <View testID="type-field">
      <FieldLabel>{t.editRequest.type}</FieldLabel>
      <View className="overflow-hidden rounded-[24px] bg-card">
        {primary.map(row)}
        <View className="border-t border-border bg-muted px-4 py-1.5">
          <Text className="text-[12px] font-semibold text-faint">{t.editRequest.others}</Text>
        </View>
        {others.map(row)}
      </View>
    </View>
  );
}
