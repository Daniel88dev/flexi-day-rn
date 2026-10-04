import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ClipboardTextIcon } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, TextInput, View } from "react-native";
import { toast } from "sonner-native";

import { Button } from "@/components/ui/button";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { joinRefusal, parseInviteInput, type JoinInput } from "@/lib/groups/invites";
import { qk, useJoinGroup, useOnline, useWriteFailure, type JoinedGroup } from "@/lib/query";

/** The Join sheet's body: one field for an invite code or a pasted invite link. */
export function JoinSheet() {
  const { t } = useTranslation();
  const labels = t.join.sheet;
  const faint = useTone("faint");
  const primary = useTone("primary");
  const online = useOnline();
  const join = useJoinGroup();
  const writeFailure = useWriteFailure();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // iOS has no live regions, so a new error is spoken outright.
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const joining = join.isPending;
  const locked = !online || joining;

  const openGroup = ({ groupId, groupName, alreadyMember }: JoinedGroup) => {
    // The sheet goes first, so the detail is not left under it.
    router.back();
    if (alreadyMember) toast.info(t.join.alreadyMember(groupName));
    else toast.success(t.join.joined(groupName));
    router.push({ pathname: "/groups/[groupId]", params: { groupId } });
  };

  const send = (input: JoinInput) => {
    join.mutate(input, {
      onSuccess: openGroup,
      onError: (failure) => {
        const refusal = joinRefusal(failure, input.kind, t);
        if (refusal.kind === "inline") setError(refusal.message);
        else
          writeFailure(failure, {
            queryKeys: [qk.administeredGroups()],
            retry: () => send(input),
          });
      },
    });
  };

  const submit = () => {
    if (locked) return;
    const input = parseInviteInput(value);
    if (!input) return;
    if (input.kind === "broken-link") {
      setError(t.join.errors.brokenLink);
      return;
    }
    setError(null);
    send(input);
  };

  const edit = (text: string) => {
    setValue(text);
    setError(null);
  };

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) edit(text);
  };

  return (
    <View testID="join-sheet" className="gap-5 bg-card px-5 pt-7 pb-6">
      <View className="gap-1.5">
        <Text
          accessibilityRole="header"
          className="font-display text-[24px] font-semibold text-foreground"
          style={{ letterSpacing: -0.4 }}
        >
          {labels.title}
        </Text>
        <Text className="text-[14.5px] leading-5 text-muted-foreground">{labels.body}</Text>
      </View>

      <View className="gap-2">
        <Text className="text-[13px] font-semibold text-muted-foreground">{labels.label}</Text>
        <View className={cn("justify-center", locked && "opacity-60")}>
          <TextInput
            testID="join-sheet-input"
            accessibilityLabel={labels.label}
            value={value}
            onChangeText={edit}
            editable={!locked}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            placeholder={labels.placeholder}
            placeholderTextColor={faint}
            selectionColor={primary}
            returnKeyType="join"
            onSubmitEditing={submit}
            className={cn(
              "h-[52px] rounded-[12px] border bg-background pr-[100px] pl-4 font-sans text-[16px] text-foreground",
              error ? "border-danger" : "border-input"
            )}
          />
          <Pressable
            testID="join-sheet-paste"
            onPress={() => void paste()}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={labels.paste}
            accessibilityState={{ disabled: locked }}
            className="absolute right-1.5 h-10 flex-row items-center gap-1.5 rounded-full bg-accent px-3.5 active:opacity-70"
          >
            <Icon icon={ClipboardTextIcon} tone="primary" size={16} weight="bold" />
            <Text className="text-[15px] font-semibold text-primary">{labels.paste}</Text>
          </Pressable>
        </View>
        {error ? (
          <Text testID="join-sheet-error" className="text-[13.5px] leading-5 text-danger">
            {error}
          </Text>
        ) : (
          <Text testID="join-sheet-helper" className="text-[12.5px] text-faint">
            {labels.helper}
          </Text>
        )}
      </View>

      {online ? null : (
        <View testID="join-sheet-offline">
          <Notice tone="accent" message={labels.offline} />
        </View>
      )}

      <Button
        testID="join-sheet-submit"
        label={joining ? labels.joining : labels.join}
        loading={joining}
        disabled={!online || value.trim().length === 0}
        onPress={submit}
      />
    </View>
  );
}
