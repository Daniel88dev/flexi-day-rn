import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { type Read } from "@/lib/groups/read-state";
import { useMyGroups, type GroupRole, type MyGroup } from "@/lib/local-store";
import {
  ApiError,
  useGroupDetail,
  useGroupMembers,
  useQuotas,
  type GroupDetail as ServerGroup,
} from "@/lib/query";

import { FactsCard } from "./facts-card";
import { GroupTabs, TabsFailed, TabsSkeleton } from "./group-tabs";
import { Monogram, RetryNotice, RoleBadge } from "./parts";

type Header = { name: string; organizationName: string | null; role: GroupRole | null };

type Facts = Pick<
  MyGroup,
  | "workingDays"
  | "holidayCountry"
  | "defaultVacationDays"
  | "defaultHomeOfficeDays"
  | "defaultSickDays"
>;

function serverFacts(group: ServerGroup): Facts {
  return {
    workingDays: group.workingDays,
    holidayCountry: group.holidayCountry,
    defaultVacationDays: group.defaultVacationDays,
    defaultHomeOfficeDays: group.defaultHomeOfficeDays,
    defaultSickDays: group.defaultSickDays ?? 0,
  };
}

function GroupHeader({ header }: { header: Header }) {
  return (
    <View testID="group-header" className="gap-3 px-1 pt-1">
      <Monogram name={header.name} size={56} />
      <View className="gap-1.5">
        <Text
          accessibilityRole="header"
          className="font-display text-[28px] leading-[34px] font-semibold text-foreground"
          style={{ letterSpacing: -0.56 }}
        >
          {header.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          {header.organizationName ? (
            <Text className="text-[15px] text-muted-foreground">{header.organizationName}</Text>
          ) : null}
          <RoleBadge role={header.role} />
        </View>
      </View>
    </View>
  );
}

function HeaderSkeleton() {
  return (
    <View testID="group-detail-loading" className="gap-3 px-1 pt-1">
      <View className="h-14 w-14 rounded-[16px] bg-muted" />
      <View className="h-7 w-1/2 rounded-full bg-muted" />
      <View className="h-4 w-1/3 rounded-full bg-muted" />
    </View>
  );
}

function Message({ testID, children }: { testID: string; children: string }) {
  return (
    <View testID={testID} className="items-center px-8 pt-24">
      <Text className="text-center text-[15px] text-muted-foreground">{children}</Text>
    </View>
  );
}

const statusOf = (error: unknown) => (error instanceof ApiError ? error.status : null);

// A plain copy read during this render: TanStack re-renders only for the fields a render touched,
// and the tabs touch the quotas read only while its tab shows.
const snapshot = <T,>({ data, isError, dataUpdatedAt }: Read<T>): Read<T> => ({
  data,
  isError,
  dataUpdatedAt,
});

/**
 * Your own group's header and facts come from the Local store, so they show offline; any other
 * group's come from the server. Members and Quotas are asked for only once the group detail read
 * says `access.canView`, never on the store's access flags (ADR 0003).
 */
export function GroupDetail({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const primary = useTone("primary");
  const own = useMyGroups().find((candidate) => candidate.id === groupId);
  const detail = useGroupDetail(groupId);
  const status = statusOf(detail.error);
  const gone = status === 404;
  const refused = status === 403;
  const canView = !gone && !refused && detail.data?.access.canView === true;
  const year = new Date().getFullYear();
  const members = useGroupMembers(canView ? groupId : null);
  const quotas = useQuotas(canView ? groupId : null, year);
  const [refreshing, setRefreshing] = useState(false);

  const server = gone || refused ? undefined : detail.data;
  const header: Header | null = own
    ? own
    : server
      ? { name: server.groupName, organizationName: server.organization?.name ?? null, role: null }
      : null;
  const facts: Facts | null = own ?? (server ? serverFacts(server) : null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        detail.refetch(),
        ...(canView ? [members.refetch(), quotas.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  const retry = () => void refresh();

  let body: ReactNode;
  if (gone) {
    body = <Message testID="group-not-found">{t.groups.notFound}</Message>;
  } else if (refused && !own) {
    body = <Message testID="group-no-access">{t.groups.noAccess}</Message>;
  } else if (!header || !facts) {
    body = detail.isPending ? (
      <HeaderSkeleton />
    ) : (
      <RetryNotice testID="group-detail" message={t.groups.detailFailed} onRetry={retry} />
    );
  } else {
    let tabs: ReactNode;
    if (canView && detail.data) {
      tabs = (
        <GroupTabs
          detail={snapshot(detail)}
          members={snapshot(members)}
          quotas={snapshot(quotas)}
          managerUserId={detail.data.managerUserId}
          defaults={{
            vacationDays: facts.defaultVacationDays,
            homeOfficeDays: facts.defaultHomeOfficeDays,
            sickDays: facts.defaultSickDays,
          }}
          sickDayBenefit={detail.data.organization?.sickDayBenefitActive === true}
          year={year}
          onRetry={retry}
        />
      );
    } else if (refused || detail.data) {
      tabs = (
        <Text testID="group-no-view-access" className="px-1 text-[13.5px] leading-5 text-faint">
          {t.groups.noViewAccess}
        </Text>
      );
    } else {
      tabs = detail.isPending ? <TabsSkeleton /> : <TabsFailed onRetry={retry} />;
    }
    body = (
      <>
        <GroupHeader header={header} />
        <FactsCard facts={facts} />
        {tabs}
      </>
    );
  }

  return (
    <StackScreen testID="group-detail" title={header?.name ?? t.nav.groups} hideTitle>
      <ScrollView
        testID="group-detail-scroll"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
        }
      >
        {body}
      </ScrollView>
    </StackScreen>
  );
}
