// PROTOTYPE (T-144, prototype/groups): the read-only group detail, three layouts behind
// ?variant=A|B|C. ?state=offline keeps loaded data with its line; ?state=cold-offline shows the
// never-loaded offline state; ?state=loading holds the skeleton.
import { ShieldCheckIcon } from "phosphor-react-native";
import { Fragment, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { PersonAvatar } from "@/components/calendar/person-avatar";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { TABULAR, Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { useViewer } from "@/lib/viewer/use-viewer";

import {
  countryName,
  useMembers,
  useQuotas,
  useServerGroup,
  useStoreGroups,
  workingDaysLabel,
  type Member,
  type Quota,
} from "./data";
import {
  Monogram,
  OrgAdminBadge,
  Pill,
  RoleBadge,
  ScreenHeader,
  SectionHeading,
  SkeletonRow,
  useProtoState,
  useVariant,
  VariantSwitcher,
  WeekdayPills,
} from "./parts";

const VARIANTS = ["A", "B", "C"] as const;
const NAMES = { A: "Tabs", B: "One scroll", C: "People" };

type Header = {
  groupName: string;
  organizationName: string | null;
  workingDays: number[];
  holidayCountry: string | null;
  defaultVacationDays: number;
  defaultHomeOfficeDays: number;
};

export function GroupDetail({ groupId }: { groupId: string }) {
  const variant = useVariant(VARIANTS);
  const state = useProtoState();
  const { tab: tabKey } = useLocalSearchParams<{ tab?: string }>();
  const viewerId = useViewer()?.id ?? null;
  const primary = useTone("primary");
  const year = new Date().getFullYear();

  const own = useStoreGroups(viewerId).find((group) => group.id === groupId) ?? null;
  const server = useServerGroup(groupId);
  const access = server.data?.access;
  const canView = access?.canView ?? false;
  const members = useMembers(groupId, canView);
  const quotas = useQuotas(groupId, year, canView);

  const coldOffline = state === "cold-offline";
  const loading = state === "loading" || (!coldOffline && server.isLoading);
  const orgAdmin = access ? access.viaOrgAdmin && !access.isMember : !own;
  const sick = server.data?.organization?.sickDayBenefitActive ?? false;

  const header: Header | null = own
    ? own
    : server.data && !coldOffline
      ? { ...server.data, organizationName: server.data.organization?.name ?? null }
      : null;

  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => {
    setRefreshing(true);
    void Promise.all([server.refetch(), members.refetch(), quotas.refetch()]).finally(() =>
      setRefreshing(false)
    );
  };

  const offlineMeta = state === "offline" ? "Offline, updated 14:02" : undefined;
  const tabsState: TabsState = coldOffline
    ? "offline"
    : loading || members.isLoading || quotas.isLoading
      ? "loading"
      : !canView
        ? "no-access"
        : "ready";

  const body = (
    <TabsBody
      key={tabKey ?? "members"}
      variant={variant}
      tabsState={tabsState}
      members={[...(members.data ?? [])].sort(
        (a, b) =>
          Number(b.userId === server.data?.managerUserId) -
            Number(a.userId === server.data?.managerUserId) ||
          a.user.name.localeCompare(b.user.name)
      )}
      quotas={quotas.data ?? []}
      managerUserId={server.data?.managerUserId ?? null}
      defaults={header}
      sick={sick}
      year={year}
      meta={offlineMeta}
      onRetry={refresh}
    />
  );

  return (
    <View testID="group-detail" className="flex-1 bg-background pt-safe">
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, gap: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
        }
      >
        {header ? (
          <HeaderBlock header={header} role={own?.role ?? null} orgAdmin={orgAdmin} />
        ) : coldOffline ? null : (
          <HeaderSkeleton />
        )}
        {header && orgAdmin ? (
          <View
            testID="group-detail-org-admin-notice"
            className="flex-row gap-3 rounded-[16px] bg-warm-soft px-4 py-3"
          >
            <View className="pt-0.5">
              <Icon icon={ShieldCheckIcon} tone="warm" size={18} weight="bold" />
            </View>
            <Text className="flex-1 text-[14px] leading-5 text-foreground">
              You&apos;re managing this group as an administrator of{" "}
              {header.organizationName ?? "your organization"}. You&apos;re not a member of it, so
              you can&apos;t book or approve leave here.
            </Text>
          </View>
        ) : null}
        {header ? <Facts header={header} /> : null}
        {coldOffline && !header ? (
          <Notice
            tone="error"
            message="Can't reach the server. This group opens once you're back online."
            action={{ label: "Retry", onPress: refresh, testID: "group-detail-retry" }}
          />
        ) : (
          body
        )}
      </ScrollView>
      <VariantSwitcher variants={VARIANTS} names={NAMES} />
    </View>
  );
}

function HeaderBlock({
  header,
  role,
  orgAdmin,
}: {
  header: Header;
  role: Parameters<typeof RoleBadge>[0]["role"];
  orgAdmin: boolean;
}) {
  return (
    <View className="gap-3 px-1 pt-1">
      <Monogram name={header.groupName} size={56} muted={orgAdmin} />
      <View className="gap-1.5">
        <Text
          testID="group-detail-name"
          className="font-display text-[28px] leading-[34px] font-semibold text-foreground"
          style={{ letterSpacing: -0.56 }}
        >
          {header.groupName}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          {header.organizationName ? (
            <Text className="text-[15px] text-muted-foreground">{header.organizationName}</Text>
          ) : null}
          {orgAdmin ? <OrgAdminBadge /> : <RoleBadge role={role} />}
        </View>
      </View>
    </View>
  );
}

function HeaderSkeleton() {
  return (
    <View className="gap-3 px-1 pt-1">
      <View className="h-14 w-14 rounded-[20px] bg-muted" />
      <View className="h-7 w-1/2 rounded-full bg-muted" />
      <View className="h-4 w-1/3 rounded-full bg-muted" />
    </View>
  );
}

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-2.5">
      <Text className="text-[15px] text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

function Facts({ header }: { header: Header }) {
  return (
    <View testID="group-detail-facts" className="overflow-hidden rounded-[24px] bg-card">
      <FactRow label="Working days">
        <View accessible accessibilityLabel={workingDaysLabel(header.workingDays)}>
          <WeekdayPills days={header.workingDays} />
        </View>
      </FactRow>
      <View className="ml-4 h-px bg-border" />
      <FactRow label="Holiday country">
        <Text className="text-[15px] font-semibold text-foreground">
          {countryName(header.holidayCountry) ?? "None"}
        </Text>
      </FactRow>
      <View className="ml-4 h-px bg-border" />
      <FactRow label="Default allowance">
        <Text className="text-[15px] font-semibold text-foreground" style={TABULAR}>
          {header.defaultVacationDays} vacation, {header.defaultHomeOfficeDays} home office
        </Text>
      </FactRow>
    </View>
  );
}

type TabsState = "loading" | "offline" | "no-access" | "ready";

function TabsBody({
  variant,
  tabsState,
  members,
  quotas,
  managerUserId,
  defaults,
  sick,
  year,
  meta,
  onRetry,
}: {
  variant: (typeof VARIANTS)[number];
  tabsState: TabsState;
  members: Member[];
  quotas: Quota[];
  managerUserId: string | null;
  defaults: Header | null;
  sick: boolean;
  year: number;
  meta?: string;
  onRetry: () => void;
}) {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<"members" | "quotas">(
    tabParam === "quotas" ? "quotas" : "members"
  );
  if (tabsState === "no-access") {
    return (
      <Text testID="group-detail-no-access" className="px-1 text-[13.5px] leading-5 text-faint">
        Members and quotas show to people with view access in this group. Ask the group&apos;s
        manager if you need them.
      </Text>
    );
  }

  const byUser = new Map(quotas.map((quota) => [quota.userId, quota]));
  const quotaOf = (userId: string): Quota =>
    byUser.get(userId) ?? {
      userId,
      vacationDays: defaults?.defaultVacationDays ?? 0,
      homeOfficeDays: defaults?.defaultHomeOfficeDays ?? 0,
      sickDays: 0,
      carriedOverDays: 0,
    };
  const people =
    tabsState === "ready"
      ? `${members.length} ${members.length === 1 ? "person" : "people"}`
      : "Members";

  const content = (which: "members" | "quotas" | "people") => {
    if (tabsState === "offline") {
      return (
        <Notice
          tone="error"
          message="Can't reach the server. Members and quotas load once you're back online."
          action={{ label: "Retry", onPress: onRetry, testID: "group-detail-tabs-retry" }}
        />
      );
    }
    if (tabsState === "loading") {
      return (
        <Inset>
          <SkeletonRow />
          <Hairline />
          <SkeletonRow />
          <Hairline />
          <SkeletonRow />
        </Inset>
      );
    }
    return (
      <Inset>
        {members.map((member, i) => (
          <Fragment key={member.id}>
            {i > 0 ? <Hairline inset={which === "quotas" ? 16 : 64} /> : null}
            {which === "members" ? (
              <MemberRow member={member} managerUserId={managerUserId} />
            ) : which === "quotas" ? (
              <QuotaRow member={member} quota={quotaOf(member.userId)} sick={sick} />
            ) : (
              <PersonRow
                member={member}
                managerUserId={managerUserId}
                quota={quotaOf(member.userId)}
                sick={sick}
              />
            )}
          </Fragment>
        ))}
      </Inset>
    );
  };

  if (variant === "A") {
    return (
      <View className="gap-3">
        <Segmented value={tab} onChange={setTab} />
        <SectionHeading
          title={tab === "members" ? people : `Allowance ${year}`}
          meta={meta ?? (tab === "quotas" ? "days per year" : undefined)}
        />
        {content(tab)}
      </View>
    );
  }
  if (variant === "B") {
    return (
      <View className="gap-6">
        <View>
          <SectionHeading title="Members" meta={meta ?? people} />
          {content("members")}
        </View>
        <View>
          <SectionHeading title={`Allowance ${year}`} meta={meta ?? "days per year"} />
          {content("quotas")}
        </View>
      </View>
    );
  }
  return (
    <View>
      <SectionHeading title="People" meta={meta ?? `${people}, allowance ${year}`} />
      {content("people")}
    </View>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: "members" | "quotas";
  onChange: (value: "members" | "quotas") => void;
}) {
  return (
    <View className="flex-row rounded-full bg-muted p-1">
      {(["members", "quotas"] as const).map((key) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            testID={`group-detail-tab-${key}`}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={cn(
              "h-9 flex-1 items-center justify-center rounded-full",
              selected && "bg-card"
            )}
          >
            <Text
              className={cn(
                "text-[14px] font-semibold",
                selected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {key === "members" ? "Members" : "Quotas"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Inset({ children }: { children: ReactNode }) {
  return <View className="overflow-hidden rounded-[24px] bg-card">{children}</View>;
}

function Hairline({ inset = 64 }: { inset?: number }) {
  return <View style={{ marginLeft: inset }} className="h-px bg-border" />;
}

function MemberBadges({ member, managerUserId }: { member: Member; managerUserId: string | null }) {
  const badges = [
    member.userId === managerUserId ? "Manager" : null,
    member.adminAccess ? "Admin" : null,
    member.approverAccess ? "Approver" : null,
  ].filter((badge): badge is string => badge !== null);
  if (badges.length === 0 && member.controlledUser) return null;
  return (
    <View className="mt-1.5 flex-row flex-wrap gap-1.5">
      {badges.map((badge) => (
        <Pill key={badge} label={badge} />
      ))}
      {member.controlledUser ? null : <Pill label="Not tracked" tone="muted" />}
    </View>
  );
}

function Identity({ member, children }: { member: Member; children?: ReactNode }) {
  return (
    <View className="flex-row gap-3 px-4 py-3.5">
      <PersonAvatar userId={member.userId} name={member.user.name} size={36} />
      <View className="flex-1">
        <Text className="text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
          {member.user.name}
        </Text>
        <Text className="text-[13px] text-faint" numberOfLines={1}>
          {member.email}
        </Text>
        {children}
      </View>
    </View>
  );
}

function MemberRow({ member, managerUserId }: { member: Member; managerUserId: string | null }) {
  return (
    <View testID={`group-member-${member.userId}`}>
      <Identity member={member}>
        <MemberBadges member={member} managerUserId={managerUserId} />
      </Identity>
    </View>
  );
}

function Figures({ quota, sick }: { quota: Quota; sick: boolean }) {
  const items: [string, string][] = [
    ["Vacation", String(quota.vacationDays)],
    ["Home office", String(quota.homeOfficeDays)],
    ...(sick ? ([["Sick days", String(quota.sickDays)]] as [string, string][]) : []),
    ["Carried over", quota.carriedOverDays > 0 ? `+${quota.carriedOverDays}` : "0"],
  ];
  return (
    <View className="mt-2.5 flex-row gap-2">
      {items.map(([label, value]) => (
        <View key={label} className="flex-1 rounded-[12px] bg-muted px-2.5 py-2">
          <Text className="font-display text-[17px] font-semibold text-foreground" style={TABULAR}>
            {value}
          </Text>
          <Text className="text-[11.5px] text-muted-foreground" numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function QuotaRow({ member, quota, sick }: { member: Member; quota: Quota; sick: boolean }) {
  return (
    <View testID={`group-quota-${member.userId}`} className="px-4 py-3.5">
      <View className="flex-row items-center gap-3">
        <PersonAvatar userId={member.userId} name={member.user.name} size={28} />
        <Text className="flex-1 text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
          {member.user.name}
        </Text>
      </View>
      <Figures quota={quota} sick={sick} />
    </View>
  );
}

function PersonRow({
  member,
  managerUserId,
  quota,
  sick,
}: {
  member: Member;
  managerUserId: string | null;
  quota: Quota;
  sick: boolean;
}) {
  return (
    <View testID={`group-person-${member.userId}`}>
      <Identity member={member}>
        <MemberBadges member={member} managerUserId={managerUserId} />
        <Figures quota={quota} sick={sick} />
      </Identity>
    </View>
  );
}
