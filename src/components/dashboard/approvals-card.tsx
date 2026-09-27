import { CheckCircleIcon, CheckIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { PersonAvatar } from "@/components/calendar/person-avatar";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { askForReason } from "@/components/requests/reason-prompt";
import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { approvalKey } from "@/lib/dashboard/approvals";
import { haptic } from "@/lib/haptics";
import {
  useApprovalDecisions,
  useMyApprovals,
  type ApprovalDecision,
  type PendingApproval,
} from "@/lib/query";
import { runDatesLabel } from "@/lib/requests/format";

function ApprovalItem({
  item,
  busy,
  disabled,
  onOpen,
  onDecide,
}: {
  item: PendingApproval;
  busy: ApprovalDecision | null;
  disabled: boolean;
  onOpen: () => void;
  onDecide: (decision: ApprovalDecision) => void;
}) {
  const { t } = useTranslation();
  const labels = t.dashboard.approvals;
  const onPrimary = useTone("onPrimary");
  const foreground = useTone("foreground");
  const range = runDatesLabel(item, t.requests.runDates);
  const year = item.from.slice(0, 4);
  const dated = year === String(new Date().getFullYear()) ? range : `${range} ${year}`;
  const meta = labels.meta(
    t.recordTypes[item.vacationType],
    dated,
    t.requests.dayCount(item.businessDays)
  );
  const key = approvalKey(item);

  return (
    <View testID={`approval-${key}`} className="flex-row items-start gap-3">
      <PersonAvatar userId={item.user.id} name={item.user.name} size={38} />
      <View className="flex-1">
        <Pressable
          testID={`approval-${key}-open`}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${item.user.name}, ${meta}`}
          className="active:opacity-70"
        >
          <Text className="text-[14.5px] font-semibold text-foreground" numberOfLines={1}>
            {item.user.name}
          </Text>
          <Text className="mb-2 text-[12.5px] text-faint">{meta}</Text>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable
            testID={`approval-${key}-approve`}
            onPress={() => onDecide("approve")}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: busy === "approve" }}
            className={cn(
              "flex-row items-center gap-1 rounded-full bg-primary px-3.5 py-2 active:opacity-90",
              disabled && busy !== "approve" && "opacity-50"
            )}
          >
            {busy === "approve" ? (
              <ActivityIndicator size="small" color={onPrimary} />
            ) : (
              <Icon icon={CheckIcon} tone="onPrimary" size={13} weight="bold" />
            )}
            <Text className="text-[13.5px] font-semibold text-primary-foreground">
              {labels.approve}
            </Text>
          </Pressable>
          <Pressable
            testID={`approval-${key}-decline`}
            onPress={() => onDecide("decline")}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: busy === "decline" }}
            className={cn(
              "flex-row items-center gap-1 rounded-full border border-input px-3.5 py-2 active:opacity-70",
              disabled && busy !== "decline" && "opacity-50"
            )}
          >
            {busy === "decline" ? <ActivityIndicator size="small" color={foreground} /> : null}
            <Text className="text-[13.5px] font-semibold text-foreground">{labels.decline}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Only for a viewer who approves in some group. Its items and their buttons come from
 * `/me/approvals`, never from local rows (ADR 0003); a read that failed shows no buttons at all.
 */
export function ApprovalsCard({ onOpen }: { onOpen: (vacationId: string) => void }) {
  const { t } = useTranslation();
  const labels = t.dashboard.approvals;
  const query = useMyApprovals();
  const { deciding, approve, decline } = useApprovalDecisions();
  const items = query.data ?? [];

  const decide = async (item: PendingApproval, decision: ApprovalDecision) => {
    if (decision === "approve") {
      haptic((await approve(item)) ? "success" : "error");
      return;
    }
    const reason = await askForReason({
      title: t.requestDetail.declineTitle,
      message: t.requestDetail.reasonBody,
      confirmLabel: labels.decline,
      cancelLabel: t.requestDetail.notNow,
    });
    if (reason !== null) haptic((await decline(item, reason)) ? "success" : "error");
  };

  let body: ReactNode;
  if (query.isError) {
    body = (
      <View className="gap-2">
        <Text className="text-[14px] text-muted-foreground">{labels.unreachable}</Text>
        <Pressable
          testID="approvals-retry"
          onPress={() => void query.refetch()}
          disabled={query.isFetching}
          accessibilityRole="button"
          className="self-start rounded-full py-1 active:opacity-70"
        >
          <Text className="text-[14px] font-semibold text-primary">{labels.retry}</Text>
        </Pressable>
      </View>
    );
  } else if (query.isPending) {
    body = <Text className="text-[14px] text-muted-foreground">{labels.loading}</Text>;
  } else if (items.length === 0) {
    body = (
      <View className="flex-row items-center gap-2.5 py-1">
        <Icon icon={CheckCircleIcon} tone="ok" size={20} />
        <Text className="text-[14px] text-muted-foreground">{labels.allCaughtUp}</Text>
      </View>
    );
  } else {
    body = (
      <View className="gap-4">
        {items.map((item) => (
          <ApprovalItem
            key={approvalKey(item)}
            item={item}
            busy={deciding?.id === approvalKey(item) ? deciding.decision : null}
            disabled={deciding !== null || item.vacationIds.length === 0}
            onOpen={() => item.vacationIds[0] && onOpen(item.vacationIds[0])}
            onDecide={(decision) => void decide(item, decision)}
          />
        ))}
      </View>
    );
  }

  return (
    <DashboardCard
      testID="approvals-card"
      title={labels.title}
      badge={
        !query.isError && items.length > 0 ? (
          <View className="rounded-full bg-warm-soft px-2.5 py-1">
            <Text className="text-[12.5px] font-semibold text-warm">
              {labels.toReview(items.length)}
            </Text>
          </View>
        ) : null
      }
    >
      {body}
    </DashboardCard>
  );
}
