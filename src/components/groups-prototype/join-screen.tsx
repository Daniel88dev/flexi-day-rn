// PROTOTYPE (T-144, prototype/groups): the join screen an invite link opens. The preview is real;
// sign-in hand-off and "Sign out and continue" are stubs. ?state=signed-out|offline|loading.
import { router } from "expo-router";
import { LinkBreakIcon, XIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { toast } from "sonner-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";
import { useViewer } from "@/lib/viewer/use-viewer";
import { openWebPage } from "@/lib/web";

import {
  AlreadyMember,
  joinErrorMessage,
  maskEmail,
  useInvitePreview,
  useJoin,
  type InvitePreview,
  type StoreGroup,
} from "./data";
import { Monogram, useProtoState } from "./parts";

const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

const expiryLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

export function JoinScreen({ token, myGroups }: { token: string; myGroups: StoreGroup[] }) {
  const state = useProtoState();
  const signedIn = useRootRoute() === "signed-in" && state !== "signed-out";
  const viewer = useViewer();
  const preview = useInvitePreview(token);
  const join = useJoin();

  const openGroup = (groupId: string) =>
    router.replace({ pathname: "/groups/[groupId]", params: { groupId } });

  const doJoin = () =>
    join.mutate(
      { kind: "link", token },
      {
        onSuccess: ({ groupId, groupName }) => {
          toast.success(`You joined ${groupName}`);
          openGroup(groupId);
        },
        onError: (failure) => {
          if (failure instanceof AlreadyMember) openGroup(failure.groupId);
          else toast.error(joinErrorMessage(failure));
        },
      }
    );

  let body: ReactNode;
  let footer: ReactNode = null;

  const notFound = preview.error instanceof ApiError && preview.error.status === 404;
  if (state === "loading" || (preview.isLoading && state !== "offline")) {
    body = <PreviewSkeleton />;
  } else if (state === "offline" || (preview.error && !notFound)) {
    body = (
      <View className="pt-10">
        <Notice
          tone="error"
          message="Can't reach the server. The invite opens once you're back online."
          action={{ label: "Retry", onPress: () => void preview.refetch(), testID: "join-retry" }}
        />
      </View>
    );
  } else if (notFound || !preview.data) {
    body = (
      <Dead
        title="This invite doesn't exist"
        body="Check the link in your email, or ask for a new invite."
      />
    );
    footer = <Button testID="join-done" label="Done" onPress={close} />;
  } else if (preview.data.status !== "open") {
    const invite = preview.data;
    const title = {
      used: "This invite has already been used",
      expired: "This invite has expired",
      revoked: "This invite was withdrawn",
      open: "",
    }[invite.status];
    body = (
      <Dead
        title={title}
        body={`Ask ${invite.inviterName ?? "the group's manager"} to send you a new one for ${invite.groupName}.`}
      />
    );
    footer = <Button testID="join-done" label="Done" onPress={close} />;
  } else {
    const invite = preview.data;
    const already = myGroups.some((group) => group.id === invite.groupId);
    const mismatch =
      signedIn &&
      invite.invitedEmail !== null &&
      viewer !== null &&
      viewer.email.toLowerCase() !== invite.invitedEmail.toLowerCase();

    body = <Preview invite={invite} masked={mismatch || !signedIn} />;
    if (!signedIn) {
      footer = (
        <View className="gap-3">
          <Button
            testID="join-sign-in"
            label="Sign in to join"
            onPress={() => router.push("/sign-in")}
          />
          <Pressable
            testID="join-create-account"
            onPress={() => void openWebPage(`/join/?token=${encodeURIComponent(token)}`)}
            accessibilityRole="link"
            className="items-center py-2 active:opacity-70"
          >
            <Text className="text-[14.5px] text-muted-foreground">
              New to flexiday?{" "}
              <Text className="font-semibold text-primary">Create your account</Text>
            </Text>
          </Pressable>
        </View>
      );
    } else if (already) {
      footer = (
        <View className="gap-3">
          <Notice tone="success" message={`You're already in ${invite.groupName}.`} />
          <Button
            testID="join-open-group"
            label="Open the group"
            onPress={() => openGroup(invite.groupId)}
          />
        </View>
      );
    } else if (mismatch) {
      footer = (
        <View className="gap-3">
          <View testID="join-wrong-account" className="rounded-[16px] bg-warm-soft px-4 py-3">
            <Text className="text-[14px] leading-5 text-foreground">
              This invite is for {maskEmail(invite.invitedEmail ?? "")}. You&apos;re signed in as{" "}
              {viewer?.email}.
            </Text>
          </View>
          <Pressable
            testID="join-sign-out-continue"
            onPress={() =>
              Alert.alert(
                "Sign out and continue?",
                "Signing out clears what this phone has stored for your account. You'll sign in with the invited address next.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: () => toast("Prototype: sign-out is stubbed"),
                  },
                ]
              )
            }
            accessibilityRole="button"
            className="h-14 items-center justify-center rounded-full border border-input bg-card active:opacity-80"
          >
            <Text className="text-[16px] font-semibold text-foreground">Sign out and continue</Text>
          </Pressable>
        </View>
      );
    } else {
      footer = (
        <Button
          testID="join-submit"
          label={join.isPending ? "Joining…" : `Join ${invite.groupName}`}
          loading={join.isPending}
          onPress={doJoin}
        />
      );
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
          accessibilityLabel="Close"
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

function Preview({ invite, masked }: { invite: InvitePreview; masked: boolean }) {
  return (
    <View testID="join-preview" className="gap-7">
      <View className="gap-4">
        <Monogram name={invite.groupName} size={64} />
        <View className="gap-1">
          <Text className="text-[15.5px] text-muted-foreground">
            {invite.inviterName
              ? `${invite.inviterName} invited you to join`
              : "You're invited to join"}
          </Text>
          <Text
            className="font-display text-[34px] leading-[40px] font-semibold text-foreground"
            style={{ letterSpacing: -0.7 }}
          >
            {invite.groupName}
          </Text>
        </View>
      </View>
      <View className="overflow-hidden rounded-[24px] bg-card">
        <View className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-2.5">
          <Text className="text-[15px] text-muted-foreground">Invite for</Text>
          <Text className="flex-shrink text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {invite.invitedEmail
              ? masked
                ? maskEmail(invite.invitedEmail)
                : invite.invitedEmail
              : "Anyone with the link"}
          </Text>
        </View>
        <View className="ml-4 h-px bg-border" />
        <View className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-2.5">
          <Text className="text-[15px] text-muted-foreground">Expires</Text>
          <Text className="text-[15px] font-semibold text-foreground">
            {expiryLabel(invite.expiresAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <View testID="join-dead" className="gap-4 pt-6">
      <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-danger-soft">
        <Icon icon={LinkBreakIcon} tone="danger" size={26} weight="bold" />
      </View>
      <View className="gap-2">
        <Text
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
    <View className="gap-4">
      <View className="h-16 w-16 rounded-[22px] bg-muted" />
      <View className="h-4 w-1/2 rounded-full bg-muted" />
      <View className="h-9 w-3/4 rounded-full bg-muted" />
      <View className="mt-3 h-[105px] rounded-[24px] bg-muted" />
    </View>
  );
}
