// Variant C "Plain": no card, no icons, underlined fields, one big headline, links in a row.
import { CaretLeftIcon } from "phosphor-react-native";
import { useRef } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from "react-native";

import { useT } from "@/prototype/i18n";
import type { SignInProps } from "@/prototype/sign-in/props";
import { Button, Field, Ic, LogoMark, Notice, T, TextLink } from "@/prototype/ui";
import { useSignIn } from "@/prototype/use-sign-in";

export function SignInC({ preset, onBack, onSuccess, onTwoFactor, openWeb }: SignInProps) {
  const { t } = useT();
  const s = useSignIn({ preset, onSuccess, onTwoFactor });
  const passwordRef = useRef<TextInput>(null);
  return (
    <View className="flex-1 bg-background pt-safe">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
        >
          <View className="mt-3 flex-row items-center justify-between">
            <Pressable onPress={onBack} hitSlop={8} className="flex-row items-center gap-0.5">
              <Ic icon={CaretLeftIcon} tone="primary" size={18} weight="bold" />
              <T className="text-[16px] font-semibold text-primary">{t.signIn.back}</T>
            </Pressable>
            <LogoMark size={26} />
          </View>
          <View className="flex-1 justify-end pt-10 pb-7">
            <T
              className="font-display text-[44px] leading-[48px] font-semibold text-foreground"
              style={{ letterSpacing: -1.3 }}
            >
              {t.signIn.submit}.
            </T>
            <T className="mt-3 text-[16px] leading-6 text-muted-foreground">
              {t.signIn.description}
            </T>
          </View>
          <View className="gap-6">
            {s.error ? <Notice tone="error" text={s.error} /> : null}
            <Field
              look="line"
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
              look="line"
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
          </View>
          <View className="gap-5 pt-8 pb-safe">
            <Button
              label={s.loading ? t.signIn.submitting : t.signIn.submit}
              loading={s.loading}
              disabled={!s.canSubmit}
              onPress={() => void s.submit()}
            />
            <View className="flex-row justify-between px-1">
              <TextLink
                size={14}
                label={t.signIn.forgot}
                onPress={() => openWeb("/forgot-password/")}
              />
              <TextLink
                size={14}
                label={t.signIn.createAccount}
                onPress={() => openWeb("/sign-up/")}
                external
              />
            </View>
            <T className="pb-3 text-[13.5px] leading-5 text-muted-foreground">
              {t.signIn.socialHint}{" "}
              <T
                className="font-semibold text-primary"
                onPress={() => openWeb("/forgot-password/")}
              >
                {t.signIn.socialHintLink}
              </T>
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
