// PROTOTYPE (T-144, prototype/groups): the join sheet. It really joins, then waits for the sync
// pull. ?state=offline shows the disabled form with its notice.
import { onlineManager } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ClipboardTextIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { toast } from "sonner-native";

import { Button } from "@/components/ui/button";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

import { AlreadyMember, joinErrorMessage, parseInviteInput, useJoin } from "./data";
import { useProtoState } from "./parts";

export function JoinSheet() {
  const state = useProtoState();
  const faint = useTone("faint");
  const primary = useTone("primary");
  const [value, setValue] = useState(state === "error" ? "7KQ2-M9PX-4HRT" : "");
  const [error, setError] = useState<string | null>(
    state === "error" ? "That invite doesn't exist. Check the code, or ask for a new invite." : null
  );
  const join = useJoin();
  const offline = state === "offline" || !onlineManager.isOnline();

  const finish = (groupId: string, message: string) => {
    router.back();
    toast.success(message);
    router.push({ pathname: "/groups/[groupId]", params: { groupId } });
  };

  const submit = () => {
    setError(null);
    const input = parseInviteInput(value);
    if (!input) return;
    if (input.kind === "broken-link") {
      setError("That link is missing its invite. Open it from your email again.");
      return;
    }
    join.mutate(input, {
      onSuccess: ({ groupId, groupName }) => finish(groupId, `You joined ${groupName}`),
      onError: (failure) => {
        if (failure instanceof AlreadyMember)
          finish(failure.groupId, "You're already in this group");
        else setError(joinErrorMessage(failure));
      },
    });
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setValue(text.trim());
      setError(null);
    }
  };

  return (
    <View testID="join-sheet" className="gap-5 bg-card px-5 pt-7 pb-6">
      <View className="gap-1.5">
        <Text
          className="font-display text-[24px] font-semibold text-foreground"
          style={{ letterSpacing: -0.4 }}
        >
          Join a group
        </Text>
        <Text className="text-[14.5px] leading-5 text-muted-foreground">
          Paste the invite link from your email, or type the invite code.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-[13px] font-semibold text-muted-foreground">Invite link or code</Text>
        <View className="justify-center">
          <TextInput
            testID="join-sheet-input"
            accessibilityLabel="Invite link or code"
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setError(null);
            }}
            editable={!offline && !join.isPending}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="7KQ2-M9PX-4HRT"
            placeholderTextColor={faint}
            selectionColor={primary}
            returnKeyType="join"
            onSubmitEditing={submit}
            className={cn(
              "h-12 rounded-[12px] border bg-background pr-[92px] pl-4 font-sans text-[16px] text-foreground",
              error ? "border-danger" : "border-input"
            )}
          />
          <Pressable
            testID="join-sheet-paste"
            onPress={() => void paste()}
            disabled={offline || join.isPending}
            accessibilityRole="button"
            accessibilityLabel="Paste"
            className="absolute right-1.5 h-9 flex-row items-center gap-1 rounded-full bg-accent px-3 active:opacity-70"
          >
            <Icon icon={ClipboardTextIcon} tone="primary" size={15} weight="bold" />
            <Text className="text-[14px] font-semibold text-primary">Paste</Text>
          </Pressable>
        </View>
        {error ? (
          <Text testID="join-sheet-error" className="text-[13.5px] leading-5 text-danger">
            {error}
          </Text>
        ) : (
          <Text className="text-[12.5px] text-faint">Creating a group stays on the web.</Text>
        )}
      </View>

      {offline ? <Notice tone="accent" message="Joining a group needs a connection." /> : null}

      <Button
        testID="join-sheet-submit"
        label={join.isPending ? "Joining…" : "Join"}
        loading={join.isPending}
        disabled={offline || value.trim().length === 0}
        onPress={submit}
      />
    </View>
  );
}
