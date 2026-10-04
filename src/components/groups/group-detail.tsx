import { ScrollView, View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { useMyGroups, type MyGroup } from "@/lib/local-store";

import { FactsCard } from "./facts-card";
import { Monogram, RoleBadge } from "./parts";

function GroupHeader({ group }: { group: MyGroup }) {
  return (
    <View testID="group-header" className="gap-3 px-1 pt-1">
      <Monogram name={group.name} size={56} />
      <View className="gap-1.5">
        <Text
          accessibilityRole="header"
          className="font-display text-[28px] leading-[34px] font-semibold text-foreground"
          style={{ letterSpacing: -0.56 }}
        >
          {group.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          {group.organizationName ? (
            <Text className="text-[15px] text-muted-foreground">{group.organizationName}</Text>
          ) : null}
          <RoleBadge role={group.role} />
        </View>
      </View>
    </View>
  );
}

/** Your own group comes from the Local store, so it shows offline. */
export function GroupDetail({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const group = useMyGroups().find((candidate) => candidate.id === groupId);

  return (
    <StackScreen testID="group-detail" title={group?.name ?? t.nav.groups} hideTitle>
      {group ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 24 }}>
          <GroupHeader group={group} />
          <FactsCard facts={group} />
        </ScrollView>
      ) : (
        <View testID="group-not-found" className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[15px] text-muted-foreground">{t.groups.notFound}</Text>
        </View>
      )}
    </StackScreen>
  );
}
