import { CheckIcon, LockKeyIcon, LockKeyOpenIcon } from "phosphor-react-native";
import { useRef } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { MIN_PASSWORD_LENGTH } from "@/lib/session/change-password";
import { useChangePassword } from "@/lib/session/use-change-password";

const PASSWORD_RULES = `minlength: ${MIN_PASSWORD_LENGTH};`;

function Changed({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <View testID="password-changed" className="flex-1 justify-center gap-6 px-6">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-ok-soft">
        <Icon icon={CheckIcon} tone="ok" size={26} weight="bold" />
      </View>
      <View className="gap-2">
        <Text
          className="font-display text-[26px] font-semibold text-foreground"
          style={{ letterSpacing: -0.5 }}
        >
          {t.settings.password.changed}
        </Text>
        <Text className="text-[15.5px] leading-[22px] text-muted-foreground">
          {t.settings.password.changedBody}
        </Text>
      </View>
      <Button testID="password-done" label={t.settings.password.done} onPress={onDone} />
    </View>
  );
}

export function ChangePasswordScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const form = useChangePassword();
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const copy = t.settings.password;

  return (
    <StackScreen title={t.settings.changePassword}>
      {form.changed ? (
        <Changed onDone={onDone} />
      ) : (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            testID="password-form"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 20, paddingHorizontal: 16, paddingTop: 8 }}
          >
            {form.errors.form ? <Notice tone="error" message={form.errors.form} /> : null}
            <Field
              testID="password-current"
              label={copy.current}
              icon={LockKeyOpenIcon}
              secure
              placeholder={copy.currentPlaceholder}
              value={form.current}
              onChangeText={form.setCurrent}
              error={form.errors.current}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => nextRef.current?.focus()}
            />
            <View className="gap-4">
              <Field
                testID="password-next"
                label={copy.next}
                icon={LockKeyIcon}
                secure
                placeholder={copy.nextPlaceholder}
                value={form.next}
                onChangeText={form.setNext}
                error={form.errors.next}
                autoComplete="new-password"
                textContentType="newPassword"
                passwordRules={PASSWORD_RULES}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
                inputRef={nextRef}
              />
              <Field
                testID="password-confirm"
                label={copy.confirm}
                icon={LockKeyIcon}
                secure
                placeholder={copy.confirmPlaceholder}
                value={form.confirm}
                onChangeText={form.setConfirm}
                error={form.errors.confirm}
                autoComplete="new-password"
                textContentType="newPassword"
                passwordRules={PASSWORD_RULES}
                returnKeyType="go"
                onSubmitEditing={() => void form.submit()}
                inputRef={confirmRef}
              />
            </View>
            <Text className="px-1 text-[13px] leading-[19px] text-faint">
              {t.settings.signsOutOthers}
            </Text>
            <Button
              testID="password-submit"
              label={form.loading ? copy.submitting : t.settings.changePassword}
              loading={form.loading}
              disabled={!form.canSubmit}
              onPress={() => void form.submit()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </StackScreen>
  );
}
