import { router } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { useMyGroups } from "@/lib/local-store";
import { useRefreshPull } from "@/lib/use-refresh-pull";

import { EmptyGroupsCard } from "./empty-groups-card";
import { GroupCard } from "./group-card";

const openGroup = (groupId: string) =>
  router.push({ pathname: "/groups/[groupId]", params: { groupId } });

export function GroupsList() {
  const { t } = useTranslation();
  const primary = useTone("primary");
  const groups = useMyGroups();
  const { refreshing, refresh } = useRefreshPull();

  return (
    <StackScreen testID="groups" title={t.nav.groups}>
      <ScrollView
        testID="groups-scroll"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
        }
      >
        {groups.length === 0 ? (
          <EmptyGroupsCard />
        ) : (
          <View testID="groups-yours">
            <Text className="font-display px-1 pb-2 text-[16px] font-semibold text-foreground">
              {t.groups.yourGroups}
            </Text>
            <View className="gap-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} onPress={() => openGroup(group.id)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </StackScreen>
  );
}
