// Variant A "Boxes": six digit boxes, method switches as text links below, like the web's card.
import { KeyIcon } from "phosphor-react-native";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";

import { useT } from "@/prototype/i18n";
import type { TwoFactorProps } from "@/prototype/two-factor/props";
import { Button, CodeBoxes, Field, Notice, ScreenHeader, T, TextLink } from "@/prototype/ui";
import { useTwoFactor } from "@/prototype/use-two-factor";

export function TwoFactorA({ methods, preset, onBack, onSuccess }: TwoFactorProps) {
  const { t } = useT();
  const f = useTwoFactor({ methods, preset, onSuccess });
  const isBackup = f.method === "backup";
  const resendLabel = f.sending
    ? t.twoFactor.sending
    : f.cooldown > 0
      ? `${t.twoFactor.resend} (${f.cooldown})`
      : t.twoFactor.resend;
  return (
    <View className="flex-1 bg-background pt-safe">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <ScreenHeader onBack={onBack} />
          <View className="flex-1 px-6 pt-10">
            <T
              className="font-display text-[28px] font-semibold text-foreground"
              style={{ letterSpacing: -0.5 }}
            >
              {t.twoFactor.title}
            </T>
            <T className="mt-2 text-[16px] leading-6 text-muted-foreground">{f.description}</T>
            <View className="mt-7 gap-4">
              {f.error ? <Notice tone="error" text={f.error} /> : null}
              {f.info ? <Notice tone="success" text={f.info} /> : null}
              {isBackup ? (
                <Field
                  label={t.twoFactor.backupCode}
                  icon={KeyIcon}
                  placeholder={t.twoFactor.backupPlaceholder}
                  value={f.code}
                  onChangeText={f.setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!f.dead}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={() => void f.submit()}
                />
              ) : (
                <CodeBoxes
                  value={f.code}
                  onChange={f.setCode}
                  onComplete={(code) => void f.submit(code)}
                  disabled={f.dead}
                />
              )}
              {f.dead ? (
                <Button label={t.twoFactor.backToSignIn} onPress={onBack} />
              ) : (
                <Button
                  label={f.loading ? t.twoFactor.submitting : t.twoFactor.submit}
                  loading={f.loading}
                  disabled={!f.canSubmit}
                  onPress={() => void f.submit()}
                />
              )}
            </View>
            {!f.dead ? (
              <View className="mt-7 items-center gap-4">
                {f.method === "otp" ? (
                  <TextLink
                    label={resendLabel}
                    onPress={() => void f.sendOtp()}
                    disabled={f.cooldown > 0 || f.sending}
                  />
                ) : null}
                {f.method !== "totp" && f.offered.totp ? (
                  <TextLink
                    label={t.twoFactor.useAuthenticator}
                    onPress={() => f.setMethod("totp")}
                  />
                ) : null}
                {f.method !== "otp" && f.offered.otp ? (
                  <TextLink label={t.twoFactor.useEmail} onPress={() => f.setMethod("otp")} />
                ) : null}
                {f.method !== "backup" ? (
                  <TextLink label={t.twoFactor.useBackup} onPress={() => f.setMethod("backup")} />
                ) : null}
              </View>
            ) : null}
          </View>
          <View className="items-center pt-4 pb-safe">
            <View className="pb-4">
              <TextLink label={t.twoFactor.backToSignIn} onPress={onBack} tone="muted" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
