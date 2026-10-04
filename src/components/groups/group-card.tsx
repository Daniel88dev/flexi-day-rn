import { CaretRightIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { administeredBadge, badgeLabel } from "@/lib/groups/access";
import type { MyGroup } from "@/lib/local-store";
import type { AdministeredGroup } from "@/lib/query";

import { GroupBadge, Monogram, type GroupIdentity } from "./parts";

function CardFrame({
  id,
  name,
  organizationName,
  badge,
  neutral,
  summary,
  onPress,
}: GroupIdentity & { id: string; summary: string; onPress: () => void }) {
  const { t } = useTranslation();
  const label = [name, organizationName, badge && badgeLabel(t, badge), summary]
    .filter(Boolean)
    .join(", ");
  return (
    <Pressable
      testID={`group-card-${id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="gap-3.5 rounded-[24px] border border-border bg-card p-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-3">
        <Monogram name={name} neutral={neutral} />
        <View className="flex-1">
          <Text
            className="font-display text-[17px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {name}
          </Text>
          {organizationName ? (
            <Text className="mt-0.5 text-[14px] text-muted-foreground" numberOfLines={1}>
              {organizationName}
            </Text>
          ) : null}
        </View>
        <GroupBadge badge={badge} />
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[13px] text-faint" numberOfLines={1}>
          {summary}
        </Text>
        <Icon icon={CaretRightIcon} tone="faint" size={16} weight="bold" />
      </View>
    </Pressable>
  );
}

export function GroupCard({ group, onPress }: { group: MyGroup; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <CardFrame
      id={group.id}
      name={group.name}
      organizationName={group.organizationName}
      badge={group.role}
      neutral={false}
      summary={t.groups.defaultsLine(group.defaultVacationDays, group.defaultHomeOfficeDays)}
      onPress={onPress}
    />
  );
}

export function AdministeredGroupCard({
  group,
  onPress,
}: {
  group: AdministeredGroup;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <CardFrame
      id={group.id}
      name={group.groupName}
      organizationName={group.organization?.name ?? null}
      badge={administeredBadge(group.viaOrgAdmin)}
      neutral
      summary={t.groups.administered.memberCount(group.memberCount)}
      onPress={onPress}
    />
  );
}
