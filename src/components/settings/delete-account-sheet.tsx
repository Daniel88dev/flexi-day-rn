import { Stack } from "expo-router";
import { ArrowSquareOutIcon, LockKeyOpenIcon, WarningCircleIcon } from "phosphor-react-native";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { blockerKey, blockerText, type DeletionBlocker } from "@/lib/session/account-deletion";
import { useAccountDeletion } from "@/lib/session/use-account-deletion";
import { openWebPage, WEB_PATHS } from "@/lib/web";

function Blockers({ blockers }: { blockers: DeletionBlocker[] }) {
  const { t } = useTranslation();
  return (
    <View testID="delete-account-blocked" className="gap-4">
      <Text
        className="font-display text-[22px] font-semibold text-foreground"
        style={{ letterSpacing: -0.4 }}
      >
        {t.settings.deleteAccount.blockedTitle}
      </Text>
      <View className="overflow-hidden rounded-[24px] bg-card">
        {blockers.map((blocker, index) => (
          <View
            key={blockerKey(blocker)}
            testID={`delete-account-blocker-${blocker.kind}`}
            className={
              index === 0
                ? "flex-row gap-3 px-4 py-3.5"
                : "flex-row gap-3 border-t border-border px-4 py-3.5"
            }
          >
            <Icon icon={WarningCircleIcon} tone="danger" size={20} />
            <Text className="flex-1 text-[15px] leading-[21px] text-foreground">
              {blockerText(blocker, t)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Delete account as a page sheet over Settings. */
export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const copy = t.settings.deleteAccount;
  const danger = useTone("danger");
  const muted = useTone("muted");
  const deletion = useAccountDeletion();
  const { view } = deletion;

  let body;
  if (view.kind === "loading") {
    body = (
      <View className="flex-row items-center gap-3 pt-2">
        <ActivityIndicator color={muted} />
        <Text className="text-[15px] text-muted-foreground">{copy.checking}</Text>
      </View>
    );
  } else if (view.kind === "unreachable") {
    body = (
      <Notice
        tone="error"
        message={t.sync.unreachable}
        action={{
          label: copy.retry,
          testID: "delete-account-retry",
          onPress: () => void deletion.reread(),
        }}
      />
    );
  } else if (view.kind === "blocked") {
    body = <Blockers blockers={view.blockers} />;
  } else if (view.kind === "web") {
    body = (
      <View className="gap-5">
        <Text className="text-[15.5px] leading-[22px] text-muted-foreground">{copy.webHint}</Text>
        <Button
          testID="delete-account-open-web"
          label={copy.openWeb}
          icon={ArrowSquareOutIcon}
          onPress={() => void openWebPage(WEB_PATHS.deleteAccount)}
        />
      </View>
    );
  } else {
    body = (
      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-[15.5px] leading-[22px] text-muted-foreground">
            {copy.whatGoes}
          </Text>
          <Text className="text-[15.5px] leading-[22px] font-semibold text-danger">
            {copy.cantUndo}
          </Text>
        </View>
        {deletion.error ? (
          <View testID="delete-account-error">
            <Notice tone="error" message={deletion.error} />
          </View>
        ) : null}
        <Field
          testID="delete-account-password"
          label={copy.password}
          icon={LockKeyOpenIcon}
          secure
          placeholder={copy.passwordPlaceholder}
          value={deletion.password}
          onChangeText={deletion.setPassword}
          error={deletion.passwordError}
          editable={!deletion.deleting}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void deletion.remove()}
        />
        <Button
          testID="delete-account-submit"
          label={deletion.deleting ? copy.deleting : deletion.retry ? copy.retry : copy.delete}
          loading={deletion.deleting}
          disabled={!deletion.canDelete}
          onPress={() => void deletion.remove()}
          // Button's own bg-primary would win over a second bg class, so the colour goes inline.
          style={{ backgroundColor: danger }}
        />
      </View>
    );
  }

  return (
    <View testID="delete-account" className="flex-1 bg-background">
      <Stack.Screen options={{ gestureEnabled: !deletion.deleting }} />
      <View className="h-14 flex-row items-center border-b border-border px-2">
        <View className="min-w-[88px] items-start">
          {deletion.deleting ? null : (
            <Pressable
              testID="delete-account-cancel"
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              className="h-10 justify-center rounded-full px-3 active:opacity-70"
            >
              <Text className="text-[16px] text-primary">{copy.cancel}</Text>
            </Pressable>
          )}
        </View>
        <Text
          className="font-display flex-1 text-center text-[17px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {copy.title}
        </Text>
        <View className="min-w-[88px]" />
      </View>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // A padding KeyboardAvoidingView measures from the screen, not the page sheet.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: 20, padding: 20, paddingBottom: 48 }}
      >
        {body}
      </ScrollView>
    </View>
  );
}
