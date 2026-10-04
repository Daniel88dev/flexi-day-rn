import { router } from "expo-router";
import { LinkBreakIcon, XIcon } from "phosphor-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";
import { toast } from "sonner-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dayAndMonth } from "@/lib/format";
import {
  closedInvite,
  inviteMissing,
  joinRefusal,
  joinScreenAction,
  type ClosedInvite,
} from "@/lib/groups/invites";
import { useMyGroups } from "@/lib/local-store";
import {
  qk,
  useInvitePreview,
  useJoinGroup,
  useOnline,
  useWriteFailure,
  type InvitePreview,
  type JoinedGroup,
} from "@/lib/query";
import { useViewer } from "@/lib/viewer/use-viewer";

import { Monogram, RetryNotice } from "./parts";

const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

const openGroup = (groupId: string) =>
  router.replace({ pathname: "/groups/[groupId]", params: { groupId } });

/** The Join screen an invite link opens: it shows the invite and joins only on Join. */
export function JoinScreen({ token }: { token: string }) {
  const { t } = useTranslation();
  const labels = t.join.screen;
  const preview = useInvitePreview(token);
  const memberGroupIds = useMyGroups().map((group) => group.id);
  const viewerEmail = useViewer()?.email ?? null;
  const online = useOnline();
  const join = useJoinGroup();
  const writeFailure = useWriteFailure();
  // A 410 on Join outranks the preview, which read the invite while it was still open.
  const [closedOnJoin, setClosedOnJoin] = useState<ClosedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const joined = ({ groupId, groupName, alreadyMember }: JoinedGroup) => {
    if (alreadyMember) toast.info(t.join.alreadyMember(groupName));
    else toast.success(t.join.joined(groupName));
    openGroup(groupId);
  };

  const send = () => {
    setError(null);
    join.mutate(
      { kind: "link", token },
      {
        onSuccess: joined,
        onError: (failure) => {
          const closed = closedInvite(failure);
          if (closed) {
            setClosedOnJoin(closed);
            return;
          }
          const refusal = joinRefusal(failure, "link", t);
          if (refusal.kind === "inline") setError(refusal.message);
          else writeFailure(failure, { queryKeys: [qk.invitePreview(token)], retry: send });
        },
      }
    );
  };

  let body: ReactNode;
  let footer: ReactNode = null;
  const done = <Button testID="join-done" label={labels.done} onPress={close} />;

  if (preview.isPending) {
    body = <PreviewSkeleton />;
  } else if (preview.isError && inviteMissing(preview.error)) {
    body = <DeadInvite title={labels.dead.notFound} body={labels.notFoundBody} />;
    footer = done;
  } else if (preview.isError) {
    body = (
      <View className="pt-10">
        <RetryNotice
          testID="join-preview"
          message={labels.loadFailed}
          onRetry={() => void preview.refetch()}
        />
      </View>
    );
  } else {
    const invite = preview.data;
    const status = closedOnJoin ?? invite.status;
    if (status !== "open") {
      body = (
        <DeadInvite
          title={labels.dead[status]}
          body={labels.askForNew(invite.inviterName, invite.groupName)}
        />
      );
      footer = done;
    } else {
      body = <InviteDetails invite={invite} />;
      const action = joinScreenAction(invite, memberGroupIds, viewerEmail);
      if (action === "already-member") {
        footer = (
          <View className="gap-3">
            <View testID="join-already-member">
              <Notice tone="success" message={labels.alreadyMember(invite.groupName)} />
            </View>
            <Button
              testID="join-open-group"
              label={labels.openGroup}
              onPress={() => openGroup(invite.groupId)}
            />
          </View>
        );
      } else if (action === "join") {
        footer = (
          <View className="gap-3">
            {error ? (
              <Text testID="join-error" className="text-[14px] leading-5 text-danger">
                {error}
              </Text>
            ) : null}
            {online ? null : (
              <View testID="join-offline">
                <Notice tone="accent" message={t.join.sheet.offline} />
              </View>
            )}
            <Button
              testID="join-submit"
              label={join.isPending ? t.join.sheet.joining : labels.join(invite.groupName)}
              loading={join.isPending}
              disabled={!online}
              onPress={send}
            />
          </View>
        );
      }
    }
  }

  return (
    <View testID="join-screen" className="flex-1 bg-background pt-safe pb-safe">
      <View className="h-14 flex-row items-center justify-end px-3">
        <Pressable
          testID="join-close"
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={labels.close}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-70"
        >
          <Icon icon={XIcon} tone="foreground" size={18} weight="bold" />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}
      >
        {body}
      </ScrollView>
      {footer ? <View className="px-5 pt-2 pb-3">{footer}</View> : null}
    </View>
  );
}

function InviteDetails({ invite }: { invite: InvitePreview }) {
  const { t } = useTranslation();
  const labels = t.join.screen;
  return (
    <View testID="join-preview" className="gap-7">
      <View className="gap-4">
        <Monogram name={invite.groupName} size={64} />
        <View className="gap-1">
          <Text className="text-[15.5px] text-muted-foreground">
            {labels.invitedBy(invite.inviterName)}
          </Text>
          <Text
            accessibilityRole="header"
            className="font-display text-[34px] leading-[40px] font-semibold text-foreground"
            style={{ letterSpacing: -0.7 }}
          >
            {invite.groupName}
          </Text>
        </View>
      </View>
      <View className="overflow-hidden rounded-[24px] bg-card">
        <DetailRow
          testID="join-invite-for"
          label={labels.inviteFor}
          value={invite.invitedEmail ?? labels.anyoneWithLink}
        />
        <View className="ml-4 h-px bg-border" />
        <DetailRow
          testID="join-expires"
          label={labels.expires}
          value={dayAndMonth(t.common.locale, invite.expiresAt)}
        />
      </View>
    </View>
  );
}

function DetailRow({ testID, label, value }: { testID: string; label: string; value: string }) {
  return (
    <View className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-2.5">
      <Text className="text-[15px] text-muted-foreground">{label}</Text>
      <Text
        testID={testID}
        className="flex-shrink text-[15px] font-semibold text-foreground"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function DeadInvite({ title, body }: { title: string; body: string }) {
  return (
    <View testID="join-dead" className="gap-4 pt-6">
      <View
        testID="join-broken-link"
        className="h-14 w-14 items-center justify-center rounded-[16px] bg-danger-soft"
      >
        <Icon icon={LinkBreakIcon} tone="danger" size={26} weight="bold" />
      </View>
      <View className="gap-2">
        <Text
          accessibilityRole="header"
          className="font-display text-[28px] leading-[34px] font-semibold text-foreground"
          style={{ letterSpacing: -0.5 }}
        >
          {title}
        </Text>
        <Text className="text-[15.5px] leading-[22px] text-muted-foreground">{body}</Text>
      </View>
    </View>
  );
}

function PreviewSkeleton() {
  return (
    <View testID="join-loading" className="gap-4">
      <View className="h-16 w-16 rounded-[16px] bg-muted" />
      <View className="h-4 w-1/2 rounded-full bg-muted" />
      <View className="h-9 w-3/4 rounded-full bg-muted" />
      <View className="mt-3 h-[105px] rounded-[24px] bg-muted" />
    </View>
  );
}
