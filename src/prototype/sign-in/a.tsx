// Variant A "Form": a straight port of the web's card, boxed fields with icons.
import { ArrowRightIcon, EnvelopeIcon, LockKeyIcon } from "phosphor-react-native";
import { useRef } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, View } from "react-native";

import { useT } from "@/prototype/i18n";
import type { SignInProps } from "@/prototype/sign-in/props";
import { Button, Field, Notice, ScreenHeader, T, TextLink } from "@/prototype/ui";
import { useSignIn } from "@/prototype/use-sign-in";

export function SignInA({ preset, onBack, onSuccess, onTwoFactor, openWeb }: SignInProps) {
  const { t } = useT();
  const s = useSignIn({ preset, onSuccess, onTwoFactor });
  const passwordRef = useRef<TextInput>(null);
  return (
    <View className="flex-1 bg-background pt-safe">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <ScreenHeader onBack={onBack} />
          <View className="flex-1 justify-center px-6 py-8">
            <T
              className="font-display text-[30px] font-semibold text-foreground"
              style={{ letterSpacing: -0.6 }}
            >
              {t.signIn.title}
            </T>
            <T className="mt-2 text-[16px] leading-6 text-muted-foreground">
              {t.signIn.description}
            </T>
            <View className="mt-7 gap-4">
              {s.error ? <Notice tone="error" text={s.error} /> : null}
              <Field
                label={t.signIn.workEmail}
                icon={EnvelopeIcon}
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
                label={t.signIn.password}
                labelRight={
                  <TextLink
                    size={13}
                    label={t.signIn.forgot}
                    onPress={() => openWeb("/forgot-password/")}
                  />
                }
                icon={LockKeyIcon}
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
              <Button
                className="mt-1"
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
            </View>
          </View>
          <View className="items-center px-6 pt-2 pb-safe">
            <View className="pb-4">
              <T className="text-[14.5px] text-muted-foreground">
                {t.signIn.newToApp}{" "}
                <T className="font-bold text-primary" onPress={() => openWeb("/sign-up/")}>
                  {t.signIn.createAccount}
                </T>
              </T>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
