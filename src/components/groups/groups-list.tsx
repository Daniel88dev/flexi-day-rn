import { router } from "expo-router";
import { PlusIcon } from "phosphor-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { clockTime } from "@/lib/format";
import { shownList, snapshot, type Read } from "@/lib/groups/read-state";
import { useMyGroups } from "@/lib/local-store";
import { useAdministeredGroups, type AdministeredGroup } from "@/lib/query";
import { useRefreshPull } from "@/lib/use-refresh-pull";

import { EmptyGroupsCard } from "./empty-groups-card";
import { AdministeredGroupCard, GroupCard } from "./group-card";

const openGroup = (groupId: string) =>
  router.push({ pathname: "/groups/[groupId]", params: { groupId } });

function JoinPill() {
  const { t } = useTranslation();
  return (
    <Pressable
      testID="groups-join"
      onPress={() => router.push("/groups/join")}
      accessibilityRole="button"
      accessibilityLabel={t.join.sheet.title}
      hitSlop={6}
      className="h-10 flex-row items-center gap-1.5 rounded-full bg-accent px-4 active:opacity-70"
    >
      <Icon icon={PlusIcon} tone="primary" size={16} weight="bold" />
      <Text className="text-[15px] font-semibold text-primary">{t.groups.join}</Text>
    </Pressable>
  );
}

const HEADING = "font-display text-[16px] font-semibold text-foreground";

function AdministeredSection({ read }: { read: Read<AdministeredGroup[]> }) {
  const { t } = useTranslation();
  const shown = shownList(read);
  if (!shown) return null;

  return (
    <View testID="groups-administered" className="pt-7">
      <View className="flex-row items-baseline justify-between gap-3 px-1 pb-2">
        <Text accessibilityRole="header" className={HEADING}>
          {t.groups.administered.heading}
        </Text>
        {shown.staleSince !== null ? (
          <Text
            testID="groups-administered-stale"
            className="shrink text-right text-[13px] text-faint"
          >
            {t.groups.offlineUpdated(clockTime(t.common.locale, shown.staleSince))}
          </Text>
        ) : null}
      </View>
      <View className="gap-3">
        {shown.items.map((group) => (
          <AdministeredGroupCard key={group.id} group={group} onPress={() => openGroup(group.id)} />
        ))}
      </View>
      <Text
        testID="groups-administered-footnote"
        className="px-1 pt-2.5 text-[12.5px] leading-[18px] text-faint"
      >
        {t.groups.administered.footnote}
      </Text>
    </View>
  );
}

export function GroupsList() {
  const { t } = useTranslation();
  const primary = useTone("primary");
  const groups = useMyGroups();
  const { refreshing, refresh } = useRefreshPull();
  const administered = useAdministeredGroups();

  const onRefresh = () => {
    refresh();
    void administered.refetch();
  };

  return (
    <StackScreen testID="groups" title={t.nav.groups} trailing={<JoinPill />}>
      <ScrollView
        testID="groups-scroll"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={onRefresh} />
        }
      >
        {groups.length === 0 ? (
          <EmptyGroupsCard />
        ) : (
          <View testID="groups-yours">
            <Text accessibilityRole="header" className={cn(HEADING, "px-1 pb-2")}>
              {t.groups.yourGroups}
            </Text>
            <View className="gap-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} onPress={() => openGroup(group.id)} />
              ))}
            </View>
          </View>
        )}
        <AdministeredSection read={snapshot(administered)} />
      </ScrollView>
    </StackScreen>
  );
}
