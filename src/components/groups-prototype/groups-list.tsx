// PROTOTYPE (T-144, prototype/groups): the Groups list, two layouts behind ?variant=A|B.
// ?state=offline keeps the administered section with its kept-data line; ?state=cold-offline
// hides it; ?state=empty pretends the store holds no groups.
import { router } from "expo-router";
import { CaretRightIcon, PlusIcon, UsersThreeIcon } from "phosphor-react-native";
import { Fragment } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useRefreshPull } from "@/lib/use-refresh-pull";
import { useViewer } from "@/lib/viewer/use-viewer";
import { openWebPage, WEB_PATHS } from "@/lib/web";

import { useAdministeredGroups, useStoreGroups, type ServerGroup, type StoreGroup } from "./data";
import {
  Monogram,
  OrgAdminBadge,
  RoleBadge,
  ScreenHeader,
  SectionHeading,
  useProtoState,
  useVariant,
  VariantSwitcher,
} from "./parts";

const VARIANTS = ["A", "B"] as const;
const NAMES = { A: "Cards", B: "Inset list" };

const openGroup = (id: string) =>
  router.push({ pathname: "/groups/[groupId]", params: { groupId: id } });

const defaultsLine = (vacation: number, home: number) =>
  `${vacation} vacation days · ${home} home office`;

export function GroupsList() {
  const variant = useVariant(VARIANTS);
  const state = useProtoState();
  const viewerId = useViewer()?.id ?? null;
  const primary = useTone("primary");
  const storeGroups = useStoreGroups(viewerId);
  const administered = useAdministeredGroups();
  const { refreshing, refresh } = useRefreshPull();

  const mine = state === "empty" ? [] : storeGroups;
  const showAdministered =
    state !== "cold-offline" && administered.data !== undefined && administered.data.length > 0;

  return (
    <View testID="groups" className="flex-1 bg-background pt-safe">
      <ScreenHeader
        title="Groups"
        right={
          <Pressable
            testID="groups-join"
            onPress={() => router.push("/groups/join")}
            accessibilityRole="button"
            accessibilityLabel="Join a group"
            className="h-9 flex-row items-center gap-1.5 rounded-full bg-accent px-3.5 active:opacity-70"
          >
            <Icon icon={PlusIcon} tone="primary" size={15} weight="bold" />
            <Text className="text-[14.5px] font-semibold text-primary">Join</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={primary}
            onRefresh={() => {
              refresh();
              void administered.refetch();
            }}
          />
        }
      >
        <View>
          {mine.length > 0 ? <SectionHeading title="Your groups" /> : null}
          {mine.length === 0 ? (
            <EmptyMine />
          ) : variant === "A" ? (
            <View className="gap-3">
              {mine.map((group) => (
                <MineCard key={group.id} group={group} />
              ))}
            </View>
          ) : (
            <Inset>
              {mine.map((group, i) => (
                <Fragment key={group.id}>
                  {i > 0 ? <Hairline /> : null}
                  <MineRow group={group} />
                </Fragment>
              ))}
            </Inset>
          )}
        </View>

        {showAdministered ? (
          <View testID="groups-administered">
            <SectionHeading
              title="Groups you administer"
              meta={state === "offline" ? "Offline, updated 14:02" : undefined}
            />
            {variant === "A" ? (
              <View className="gap-3">
                {administered.data!.map((group) => (
                  <AdministeredCard key={group.id} group={group} />
                ))}
              </View>
            ) : (
              <Inset>
                {administered.data!.map((group, i) => (
                  <Fragment key={group.id}>
                    {i > 0 ? <Hairline /> : null}
                    <AdministeredRow group={group} />
                  </Fragment>
                ))}
              </Inset>
            )}
            <Text className="px-1 pt-2.5 text-[12.5px] leading-[18px] text-faint">
              You manage these through your organization. You aren&apos;t a member, so you
              can&apos;t book or approve leave in them.
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <VariantSwitcher variants={VARIANTS} names={NAMES} />
    </View>
  );
}

function MineCard({ group }: { group: StoreGroup }) {
  return (
    <Pressable
      testID={`group-${group.id}`}
      onPress={() => openGroup(group.id)}
      accessibilityRole="button"
      accessibilityLabel={group.groupName}
      className="gap-3.5 rounded-[24px] border border-border bg-card px-4 py-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-3">
        <Monogram name={group.groupName} />
        <View className="flex-1">
          <Text
            className="font-display text-[17px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {group.groupName}
          </Text>
          {group.organizationName ? (
            <Text className="mt-0.5 text-[14px] text-muted-foreground" numberOfLines={1}>
              {group.organizationName}
            </Text>
          ) : null}
        </View>
        <RoleBadge role={group.role} />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] text-faint">
          {defaultsLine(group.defaultVacationDays, group.defaultHomeOfficeDays)}
        </Text>
        <Icon icon={CaretRightIcon} tone="faint" size={16} weight="bold" />
      </View>
    </Pressable>
  );
}

function AdministeredCard({ group }: { group: ServerGroup }) {
  return (
    <Pressable
      testID={`group-${group.id}`}
      onPress={() => openGroup(group.id)}
      accessibilityRole="button"
      accessibilityLabel={group.groupName}
      className="gap-3.5 rounded-[24px] border border-border bg-card px-4 py-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-3">
        <Monogram name={group.groupName} muted />
        <View className="flex-1">
          <Text
            className="font-display text-[17px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {group.groupName}
          </Text>
          <Text className="mt-0.5 text-[14px] text-muted-foreground" numberOfLines={1}>
            {group.organization?.name}
          </Text>
        </View>
        <OrgAdminBadge />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] text-faint">
          {group.memberCount === 1 ? "1 member" : `${group.memberCount ?? 0} members`}
        </Text>
        <Icon icon={CaretRightIcon} tone="faint" size={16} weight="bold" />
      </View>
    </Pressable>
  );
}

function Inset({ children }: { children: React.ReactNode }) {
  return <View className="overflow-hidden rounded-[24px] bg-card">{children}</View>;
}

function Hairline() {
  return <View className="ml-[64px] h-px bg-border" />;
}

function InsetRow({
  id,
  name,
  line,
  badge,
  muted,
}: {
  id: string;
  name: string;
  line: string;
  badge: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Pressable
      testID={`group-${id}`}
      onPress={() => openGroup(id)}
      accessibilityRole="button"
      accessibilityLabel={name}
      className="min-h-[68px] flex-row items-center gap-3 px-4 py-3 active:opacity-70"
    >
      <Monogram name={name} size={36} muted={muted} />
      <View className="flex-1">
        <Text className="text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
          {name}
        </Text>
        <Text className="mt-0.5 text-[13px] text-faint" numberOfLines={1}>
          {line}
        </Text>
      </View>
      {badge}
      <Icon icon={CaretRightIcon} tone="faint" size={14} weight="bold" />
    </Pressable>
  );
}

function MineRow({ group }: { group: StoreGroup }) {
  return (
    <InsetRow
      id={group.id}
      name={group.groupName}
      line={[group.organizationName, `${group.defaultVacationDays} vacation days`]
        .filter(Boolean)
        .join(" · ")}
      badge={<RoleBadge role={group.role} />}
    />
  );
}

function AdministeredRow({ group }: { group: ServerGroup }) {
  return (
    <InsetRow
      id={group.id}
      name={group.groupName}
      line={[group.organization?.name, `${group.memberCount ?? 0} members`]
        .filter(Boolean)
        .join(" · ")}
      badge={<OrgAdminBadge />}
      muted
    />
  );
}

function EmptyMine() {
  return (
    <View testID="groups-empty" className="gap-4 rounded-[24px] border border-border bg-card p-5">
      <View className="h-11 w-11 items-center justify-center rounded-[16px] bg-accent">
        <Icon icon={UsersThreeIcon} tone="primary" size={22} weight="bold" />
      </View>
      <View className="gap-1.5">
        <Text className="font-display text-[19px] font-semibold text-foreground">
          You&apos;re not in a group yet
        </Text>
        <Text className="text-[14.5px] leading-5 text-muted-foreground">
          Join with the invite code or link your manager sent you. Booking leave starts once
          you&apos;re in a group.
        </Text>
      </View>
      <Button
        testID="groups-empty-join"
        label="Join a group"
        onPress={() => router.push("/groups/join")}
        className="h-12"
      />
      <Pressable
        testID="groups-empty-create"
        onPress={() => void openWebPage(WEB_PATHS.groups)}
        accessibilityRole="link"
        className="items-center py-1 active:opacity-70"
      >
        <Text className="text-[14.5px] font-semibold text-primary">Create a group on the web</Text>
      </Pressable>
    </View>
  );
}
