import { Fragment, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { PersonAvatar } from "@/components/calendar/person-avatar";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  memberBadges,
  orderedMembers,
  quotaFigures,
  type QuotaDefaults,
} from "@/lib/groups/members";
import { clockTime } from "@/lib/format";
import { tabReadState, type Read } from "@/lib/groups/read-state";
import type { GroupMember, UserYearQuota } from "@/lib/query";

import { Pill, RetryNotice } from "./parts";

type Tab = "members" | "quotas";

const TABULAR = { fontVariant: ["tabular-nums" as const] };

function Segmented({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-full bg-muted p-1">
      {(["members", "quotas"] as const).map((tab) => {
        const selected = tab === value;
        return (
          <Pressable
            key={tab}
            testID={`group-tab-${tab}`}
            onPress={() => onChange(tab)}
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
              {t.groups[tab].tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeading({ title, meta, stale }: { title: string; meta?: string; stale?: string }) {
  return (
    <View className="gap-0.5 px-1">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text
          accessibilityRole="header"
          className="font-display text-[16px] font-semibold text-foreground"
        >
          {title}
        </Text>
        {meta ? (
          <Text testID="group-tabs-meta" className="shrink text-right text-[13px] text-faint">
            {meta}
          </Text>
        ) : null}
      </View>
      {stale ? (
        <Text testID="group-tabs-stale" className="text-[13px] text-faint">
          {stale}
        </Text>
      ) : null}
    </View>
  );
}

function Inset({ children }: { children: ReactNode }) {
  return <View className="overflow-hidden rounded-[24px] bg-card">{children}</View>;
}

const Hairline = ({ inset }: { inset: number }) => (
  <View style={{ marginLeft: inset }} className="h-px bg-border" />
);

export function TabsSkeleton() {
  return (
    <View testID="group-tabs-loading" className="gap-3">
      <View className="h-11 rounded-full bg-muted" />
      <Inset>
        {[0, 1, 2].map((row) => (
          <Fragment key={row}>
            {row > 0 ? <Hairline inset={64} /> : null}
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="h-9 w-9 rounded-full bg-muted" />
              <View className="flex-1 gap-2">
                <View className="h-4 w-1/2 rounded-full bg-muted" />
                <View className="h-3 w-2/3 rounded-full bg-muted" />
              </View>
            </View>
          </Fragment>
        ))}
      </Inset>
    </View>
  );
}

export function TabsFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return <RetryNotice testID="group-tabs" message={t.groups.tabsFailed} onRetry={onRetry} />;
}

function MemberRow({ member, managerUserId }: { member: GroupMember; managerUserId: string }) {
  const { t } = useTranslation();
  const { roles, tracked } = memberBadges(member, managerUserId);
  return (
    <View testID={`group-member-${member.userId}`} className="flex-row gap-3 px-4 py-3.5">
      <PersonAvatar userId={member.userId} name={member.user.name} size={36} />
      <View className="flex-1">
        <Text className="text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
          {member.user.name}
        </Text>
        <Text className="text-[13px] text-faint" numberOfLines={1}>
          {member.email}
        </Text>
        {roles.length > 0 || !tracked ? (
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {roles.map((role) => (
              <Pill key={role} testID={`member-badge-${role}`} label={t.groups.roles[role]} />
            ))}
            {tracked ? null : (
              <Pill
                testID="member-badge-not-tracked"
                tone="muted"
                label={t.groups.members.notTracked}
              />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function QuotaRow({
  member,
  quota,
  defaults,
  sickDayBenefit,
}: {
  member: GroupMember;
  quota: UserYearQuota | undefined;
  defaults: QuotaDefaults;
  sickDayBenefit: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View testID={`group-quota-${member.userId}`} className="px-4 py-3.5">
      <View className="flex-row items-center gap-3">
        <PersonAvatar userId={member.userId} name={member.user.name} size={28} />
        <Text className="flex-1 text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
          {member.user.name}
        </Text>
      </View>
      <View className="mt-2.5 flex-row gap-2">
        {quotaFigures(quota, defaults, sickDayBenefit).map(({ key, value }) => (
          <View
            key={key}
            testID={`quota-figure-${key}`}
            accessible
            accessibilityLabel={`${t.groups.quotas.figures[key]}: ${value}`}
            className="flex-1 rounded-[16px] bg-muted px-2.5 py-2"
          >
            <Text
              className="font-display text-[17px] font-semibold text-foreground"
              style={TABULAR}
            >
              {value}
            </Text>
            <Text className="text-[11.5px] text-muted-foreground" numberOfLines={1}>
              {t.groups.quotas.figures[key]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The detail owns the reads, so its pull-to-refresh reaches them. */
export function GroupTabs({
  detail,
  members,
  quotas,
  managerUserId,
  defaults,
  sickDayBenefit,
  year,
  onRetry,
}: {
  detail: Read<unknown>;
  members: Read<GroupMember[]>;
  quotas: Read<UserYearQuota[]>;
  managerUserId: string;
  defaults: QuotaDefaults;
  sickDayBenefit: boolean;
  year: number;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("members");
  const state = tabReadState(tab === "members" ? [detail, members] : [detail, members, quotas]);

  const staleLine =
    state.kind === "ready" && state.staleSince !== null
      ? t.groups.offlineUpdated(clockTime(t.common.locale, state.staleSince))
      : undefined;

  const rows = orderedMembers(members.data ?? [], managerUserId);
  const quotaByUser = new Map((quotas.data ?? []).map((quota) => [quota.userId, quota]));

  return (
    <View testID="group-tabs" className="gap-3">
      <Segmented value={tab} onChange={setTab} />
      {state.kind === "loading" ? (
        <TabsSkeleton />
      ) : state.kind === "failed" ? (
        <TabsFailed onRetry={onRetry} />
      ) : tab === "members" ? (
        <View testID="group-members" className="gap-3">
          <SectionHeading title={t.groups.members.heading(rows.length)} stale={staleLine} />
          <Inset>
            {rows.map((member, index) => (
              <Fragment key={member.userId}>
                {index > 0 ? <Hairline inset={64} /> : null}
                <MemberRow member={member} managerUserId={managerUserId} />
              </Fragment>
            ))}
          </Inset>
        </View>
      ) : (
        <View testID="group-quotas" className="gap-3">
          <SectionHeading
            title={t.groups.quotas.heading(year)}
            meta={t.groups.quotas.perYear}
            stale={staleLine}
          />
          <Inset>
            {rows.map((member, index) => (
              <Fragment key={member.userId}>
                {index > 0 ? <Hairline inset={16} /> : null}
                <QuotaRow
                  member={member}
                  quota={quotaByUser.get(member.userId)}
                  defaults={defaults}
                  sickDayBenefit={sickDayBenefit}
                />
              </Fragment>
            ))}
          </Inset>
        </View>
      )}
    </View>
  );
}
