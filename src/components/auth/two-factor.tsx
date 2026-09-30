import { KeyIcon } from "phosphor-react-native";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";

import { ScreenHeader } from "@/components/auth/screen-header";
import { Button } from "@/components/ui/button";
import { CodeBoxes } from "@/components/ui/code-boxes";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/text-link";
import { useTranslation } from "@/i18n/use-translation";
import { useTwoFactor } from "@/lib/session/use-two-factor";

export function TwoFactor({ methods, onBack }: { methods: string[]; onBack: () => void }) {
  const { t } = useTranslation();
  const form = useTwoFactor({ methods });
  const resendLabel =
    form.cooldown > 0 ? `${t.auth.twoFactor.resend} (${form.cooldown})` : t.auth.twoFactor.resend;

  return (
    <View testID="auth-two-factor" className="flex-1 bg-background pt-safe">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <ScreenHeader onBack={onBack} backLabel={t.auth.signIn.back} />
          <View className="flex-1 px-6 pt-10">
            <Text
              className="font-display text-[28px] font-semibold text-foreground"
              style={{ letterSpacing: -0.5 }}
            >
              {t.auth.twoFactor.title}
            </Text>
            <Text className="mt-2 text-[16px] leading-6 text-muted-foreground">
              {form.description}
            </Text>
            <View className="mt-7 gap-4">
              {form.error ? <Notice tone="error" message={form.error} /> : null}
              {form.info ? <Notice tone="success" message={form.info} /> : null}
              {form.method === "backup" ? (
                <Field
                  testID="auth-two-factor-backup-code"
                  label={t.auth.twoFactor.backupCode}
                  icon={KeyIcon}
                  placeholder={t.auth.twoFactor.backupPlaceholder}
                  value={form.code}
                  onChangeText={form.setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!form.challengeDead}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={() => void form.submit()}
                />
              ) : (
                <CodeBoxes
                  testID="auth-two-factor-code"
                  label={t.auth.twoFactor.code}
                  value={form.code}
                  onChange={form.setCode}
                  onComplete={(code) => void form.submit(code)}
                  disabled={form.challengeDead}
                />
              )}
              {form.challengeDead ? (
                <Button
                  testID="auth-two-factor-restart"
                  label={t.auth.twoFactor.backToSignIn}
                  onPress={onBack}
                />
              ) : (
                <Button
                  testID="auth-two-factor-submit"
                  label={form.loading ? t.auth.twoFactor.submitting : t.auth.twoFactor.submit}
                  loading={form.loading}
                  disabled={!form.canSubmit}
                  onPress={() => void form.submit()}
                />
              )}
            </View>
            {form.challengeDead ? null : (
              <View className="mt-7 items-center gap-4">
                {form.method === "otp" ? (
                  <TextLink
                    testID="auth-two-factor-resend"
                    label={resendLabel}
                    onPress={() => void form.sendOtp()}
                    disabled={!form.canResend}
                  />
                ) : null}
                {form.method !== "totp" && form.offered.totp ? (
                  <TextLink
                    testID="auth-two-factor-use-totp"
                    label={t.auth.twoFactor.useAuthenticator}
                    onPress={() => form.setMethod("totp")}
                  />
                ) : null}
                {form.method !== "otp" && form.offered.otp ? (
                  <TextLink
                    testID="auth-two-factor-use-otp"
                    label={t.auth.twoFactor.useEmail}
                    onPress={() => form.setMethod("otp")}
                  />
                ) : null}
                {form.method !== "backup" ? (
                  <TextLink
                    testID="auth-two-factor-use-backup"
                    label={t.auth.twoFactor.useBackup}
                    onPress={() => form.setMethod("backup")}
                  />
                ) : null}
              </View>
            )}
          </View>
          <View className="items-center px-6 pt-4 pb-safe">
            <View className="pb-4">
              <TextLink
                testID="auth-two-factor-back-to-sign-in"
                label={t.auth.twoFactor.backToSignIn}
                onPress={onBack}
                muted
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
