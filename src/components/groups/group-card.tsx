import { CaretRightIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import type { MyGroup } from "@/lib/local-store";

import { Monogram, RoleBadge } from "./parts";

export function GroupCard({ group, onPress }: { group: MyGroup; onPress: () => void }) {
  const { t } = useTranslation();
  const defaults = t.groups.defaultsLine(group.defaultVacationDays, group.defaultHomeOfficeDays);
  const label = [
    group.name,
    group.organizationName,
    group.role ? t.groups.roles[group.role] : null,
    defaults,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      testID={`group-card-${group.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="gap-3.5 rounded-[24px] border border-border bg-card p-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-3">
        <Monogram name={group.name} />
        <View className="flex-1">
          <Text
            className="font-display text-[17px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {group.name}
          </Text>
          {group.organizationName ? (
            <Text className="mt-0.5 text-[14px] text-muted-foreground" numberOfLines={1}>
              {group.organizationName}
            </Text>
          ) : null}
        </View>
        <RoleBadge role={group.role} />
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[13px] text-faint" numberOfLines={1}>
          {defaults}
        </Text>
        <Icon icon={CaretRightIcon} tone="faint" size={16} weight="bold" />
      </View>
    </Pressable>
  );
}
