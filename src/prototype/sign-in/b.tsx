// Variant B "Sheet": violet header band, the form rides on a paper sheet with the button docked.
import { ArrowRightIcon } from "phosphor-react-native";
import { useRef } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, View } from "react-native";

import { useT } from "@/prototype/i18n";
import type { SignInProps } from "@/prototype/sign-in/props";
import { BackButton, Button, Field, LogoMark, Notice, T, TextLink, Wordmark } from "@/prototype/ui";
import { useSignIn } from "@/prototype/use-sign-in";

export function SignInB({ preset, onBack, onSuccess, onTwoFactor, openWeb }: SignInProps) {
  const { t } = useT();
  const s = useSignIn({ preset, onSuccess, onTwoFactor });
  const passwordRef = useRef<TextInput>(null);
  return (
    <View className="flex-1 bg-primary">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="px-6 pt-safe">
          <View className="mt-3 flex-row items-center justify-between">
            <BackButton onPress={onBack} invert />
            <View className="flex-row items-center gap-2">
              <LogoMark size={24} invert />
              <Wordmark size={22} invert />
            </View>
            <View className="w-10" />
          </View>
          <T
            className="mt-8 mb-7 font-display text-[34px] font-semibold text-primary-foreground"
            style={{ letterSpacing: -0.8 }}
          >
            {t.signIn.title}
          </T>
        </View>
        <View className="flex-1 rounded-t-[32px] bg-background px-6 pt-7">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
            <T className="text-[16px] leading-6 text-muted-foreground">{t.signIn.description}</T>
            <View className="mt-6 gap-4">
              {s.error ? <Notice tone="error" text={s.error} /> : null}
              <Field
                look="sheet"
                label={t.signIn.workEmail}
                placeholder={t.signIn.emailPlaceholder}
                value={s.email}
                onChangeText={s.setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Field
                look="sheet"
                label={t.signIn.password}
                secure
                placeholder={t.signIn.passwordPlaceholder}
                value={s.password}
                onChangeText={s.setPassword}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void s.submit()}
                inputRef={passwordRef}
              />
              <View className="flex-row justify-end">
                <TextLink
                  size={14}
                  label={t.signIn.forgot}
                  onPress={() => openWeb("/forgot-password/")}
                />
              </View>
            </View>
            <View className="flex-1" />
            <View className="gap-4 pt-6 pb-safe">
              <Button
                label={s.loading ? t.signIn.submitting : t.signIn.submit}
                loading={s.loading}
                disabled={!s.canSubmit}
                onPress={() => void s.submit()}
                icon={ArrowRightIcon}
              />
              <T className="text-center text-[13.5px] leading-5 text-muted-foreground">
                {t.signIn.socialHint}{" "}
                <T
                  className="font-semibold text-primary"
                  onPress={() => openWeb("/forgot-password/")}
                >
                  {t.signIn.socialHintLink}
                </T>
              </T>
              <T className="pb-3 text-center text-[14.5px] text-muted-foreground">
                {t.signIn.newToApp}{" "}
                <T className="font-bold text-primary" onPress={() => openWeb("/sign-up/")}>
                  {t.signIn.createAccount}
                </T>
              </T>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
