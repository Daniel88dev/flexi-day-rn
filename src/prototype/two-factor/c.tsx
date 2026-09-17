// Variant C "List": pick the method from a list first, the code entry appears under it.
import {
  CheckCircleIcon,
  CircleIcon,
  DeviceMobileIcon,
  EnvelopeIcon,
  HashIcon,
  KeyIcon,
  type Icon,
} from "phosphor-react-native";
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";

import { useT } from "@/prototype/i18n";
import type { TwoFactorMethod } from "@/prototype/stub-auth";
import type { TwoFactorProps } from "@/prototype/two-factor/props";
import { Button, cn, Field, Ic, Notice, ScreenHeader, T, TextLink } from "@/prototype/ui";
import { useTwoFactor } from "@/prototype/use-two-factor";

const ROWS: { method: TwoFactorMethod; icon: Icon }[] = [
  { method: "totp", icon: DeviceMobileIcon },
  { method: "otp", icon: EnvelopeIcon },
  { method: "backup", icon: KeyIcon },
];

export function TwoFactorC({ methods, preset, onBack, onSuccess }: TwoFactorProps) {
  const { t } = useT();
  const f = useTwoFactor({ methods, preset, onSuccess });
  const isBackup = f.method === "backup";
  const rows = ROWS.filter((r) => f.offered[r.method]);
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
          <View className="flex-1 px-6 pt-8">
            <T
              className="font-display text-[28px] font-semibold text-foreground"
              style={{ letterSpacing: -0.5 }}
            >
              {t.twoFactor.title}
            </T>
            <T className="mt-2 text-[16px] leading-6 text-muted-foreground">{t.twoFactor.choose}</T>
            <View
              className={cn(
                "mt-6 overflow-hidden rounded-2xl border border-border bg-card",
                f.dead && "opacity-50"
              )}
            >
              {rows.map((row, i) => {
                const selected = f.method === row.method;
                return (
                  <Pressable
                    key={row.method}
                    disabled={f.dead}
                    onPress={() => f.setMethod(row.method)}
                    className={cn(
                      "flex-row items-center gap-3.5 px-4 py-3.5 active:bg-secondary",
                      i < rows.length - 1 && "border-b border-border"
                    )}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
                      <Ic icon={row.icon} tone={selected ? "primary" : "muted"} size={20} />
                    </View>
                    <View className="flex-1">
                      <T className="text-[16px] font-semibold text-foreground">
                        {t.twoFactor.methods[row.method]}
                      </T>
                      <T className="mt-0.5 text-[13.5px] text-muted-foreground">
                        {t.twoFactor.methodHints[row.method]}
                      </T>
                    </View>
                    <Ic
                      icon={selected ? CheckCircleIcon : CircleIcon}
                      tone={selected ? "primary" : "faint"}
                      size={22}
                      weight={selected ? "fill" : "regular"}
                    />
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-7 gap-4">
              {f.error ? <Notice tone="error" text={f.error} /> : null}
              {f.info ? <Notice tone="success" text={f.info} /> : null}
              {f.dead ? (
                <Button label={t.twoFactor.backToSignIn} onPress={onBack} />
              ) : (
                <>
                  <Field
                    label={isBackup ? t.twoFactor.backupCode : t.twoFactor.code}
                    icon={isBackup ? KeyIcon : HashIcon}
                    placeholder={
                      isBackup ? t.twoFactor.backupPlaceholder : t.twoFactor.codePlaceholder
                    }
                    value={f.code}
                    onChangeText={f.setCode}
                    keyboardType={isBackup ? "default" : "number-pad"}
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    onSubmitEditing={() => void f.submit()}
                  />
                  {f.method === "otp" ? (
                    <View className="flex-row justify-end">
                      <TextLink
                        size={13.5}
                        label={resendLabel}
                        onPress={() => void f.sendOtp()}
                        disabled={f.cooldown > 0 || f.sending}
                      />
                    </View>
                  ) : null}
                  <Button
                    label={f.loading ? t.twoFactor.submitting : t.twoFactor.submit}
                    loading={f.loading}
                    disabled={!f.canSubmit}
                    onPress={() => void f.submit()}
                  />
                </>
              )}
            </View>
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
