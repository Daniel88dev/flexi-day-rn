import { KeyIcon } from "phosphor-react-native";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";

import { ScreenHeader } from "@/components/auth/screen-header";
import { Button } from "@/components/ui/button";
import { CodeBoxes } from "@/components/ui/code-boxes";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field } from "@/components/ui/field";
import { SuccessNotice } from "@/components/ui/success-notice";
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
    <View className="flex-1 bg-background pt-safe">
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
              {form.error ? <ErrorNotice message={form.error} /> : null}
              {form.info ? <SuccessNotice message={form.info} /> : null}
              {form.method === "backup" ? (
                <Field
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
                  label={t.auth.twoFactor.code}
                  value={form.code}
                  onChange={form.setCode}
                  onComplete={(code) => void form.submit(code)}
                  disabled={form.challengeDead}
                />
              )}
              {form.challengeDead ? (
                <Button label={t.auth.twoFactor.backToSignIn} onPress={onBack} />
              ) : (
                <Button
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
                    label={resendLabel}
                    onPress={() => void form.sendOtp()}
                    disabled={!form.canResend}
                  />
                ) : null}
                {form.method !== "totp" && form.offered.totp ? (
                  <TextLink
                    label={t.auth.twoFactor.useAuthenticator}
                    onPress={() => form.setMethod("totp")}
                  />
                ) : null}
                {form.method !== "otp" && form.offered.otp ? (
                  <TextLink
                    label={t.auth.twoFactor.useEmail}
                    onPress={() => form.setMethod("otp")}
                  />
                ) : null}
                {form.method !== "backup" ? (
                  <TextLink
                    label={t.auth.twoFactor.useBackup}
                    onPress={() => form.setMethod("backup")}
                  />
                ) : null}
              </View>
            )}
          </View>
          <View className="items-center px-6 pt-4 pb-safe">
            <View className="pb-4">
              <TextLink label={t.auth.twoFactor.backToSignIn} onPress={onBack} muted />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
