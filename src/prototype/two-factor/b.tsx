// Variant B "Segmented": the method is a segmented control up top, one big centred input.
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from "react-native";

import { useT } from "@/prototype/i18n";
import type { TwoFactorMethod } from "@/prototype/stub-auth";
import type { TwoFactorProps } from "@/prototype/two-factor/props";
import { Button, cn, Notice, ScreenHeader, T, TextLink, useTone } from "@/prototype/ui";
import { useTwoFactor } from "@/prototype/use-two-factor";

const ORDER: TwoFactorMethod[] = ["totp", "otp", "backup"];

export function TwoFactorB({ methods, preset, onBack, onSuccess }: TwoFactorProps) {
  const { t } = useT();
  const f = useTwoFactor({ methods, preset, onSuccess });
  const [focused, setFocused] = useState(false);
  const faint = useTone("faint");
  const primary = useTone("primary");
  const isBackup = f.method === "backup";
  const segments = ORDER.filter((m) => f.offered[m]);
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
            <View
              className={cn("mt-6 flex-row rounded-full bg-secondary p-1", f.dead && "opacity-50")}
            >
              {segments.map((m) => {
                const active = f.method === m;
                return (
                  <Pressable
                    key={m}
                    disabled={f.dead}
                    onPress={() => f.setMethod(m)}
                    className={cn(
                      "flex-1 items-center justify-center rounded-full py-2.5",
                      active && "bg-card shadow-sm"
                    )}
                  >
                    <T
                      className={cn(
                        "text-[14px] font-semibold",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {t.twoFactor.methods[m]}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <T className="mt-7 text-center text-[16px] leading-6 text-muted-foreground">
              {f.description}
            </T>
            <TextInput
              value={f.code}
              onChangeText={f.setCode}
              editable={!f.dead}
              autoFocus
              keyboardType={isBackup ? "default" : "number-pad"}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={isBackup ? 11 : 6}
              placeholder={isBackup ? t.twoFactor.backupPlaceholder : t.twoFactor.codePlaceholder}
              placeholderTextColor={faint}
              selectionColor={primary}
              returnKeyType="go"
              onSubmitEditing={() => void f.submit()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className={cn(
                "mt-6 border-b-2 pb-2 text-center font-display font-semibold text-foreground",
                isBackup ? "text-[26px]" : "text-[36px]",
                focused ? "border-primary" : "border-input",
                f.dead && "opacity-50"
              )}
              style={{ letterSpacing: isBackup ? 2 : 10 }}
            />
            <View className="mt-5 min-h-[48px] gap-3">
              {f.error ? <Notice tone="error" text={f.error} /> : null}
              {f.info ? <Notice tone="success" text={f.info} /> : null}
            </View>
            <View className="mt-2 items-center gap-5">
              {f.dead ? (
                <Button
                  className="self-stretch"
                  label={t.twoFactor.backToSignIn}
                  onPress={onBack}
                />
              ) : (
                <Button
                  className="self-stretch"
                  label={f.loading ? t.twoFactor.submitting : t.twoFactor.submit}
                  loading={f.loading}
                  disabled={!f.canSubmit}
                  onPress={() => void f.submit()}
                />
              )}
              {f.method === "otp" && !f.dead ? (
                <TextLink
                  label={resendLabel}
                  onPress={() => void f.sendOtp()}
                  disabled={f.cooldown > 0 || f.sending}
                />
              ) : null}
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
