import { ArrowRightIcon, EnvelopeIcon, LockKeyIcon } from "phosphor-react-native";
import { useRef } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, View } from "react-native";

import { ScreenHeader } from "@/components/auth/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/text-link";
import { useTranslation } from "@/i18n/use-translation";
import { useSignIn } from "@/lib/session/use-sign-in";

export function SignIn({
  onBack,
  onForgotPassword,
  onCreateAccount,
}: {
  onBack: () => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
}) {
  const { t } = useTranslation();
  const form = useSignIn();
  const passwordRef = useRef<TextInput>(null);

  return (
    <View className="flex-1 bg-background pt-safe">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <ScreenHeader onBack={onBack} backLabel={t.auth.signIn.back} />
          <View className="flex-1 justify-center px-6 py-8">
            <Text
              className="font-display text-[30px] font-semibold text-foreground"
              style={{ letterSpacing: -0.6 }}
            >
              {t.auth.signIn.title}
            </Text>
            <Text className="mt-2 text-[16px] leading-6 text-muted-foreground">
              {t.auth.signIn.description}
            </Text>
            <View className="mt-7 gap-4">
              {form.error ? <Notice tone="error" message={form.error} /> : null}
              <Field
                testID="sign-in-email"
                label={t.auth.workEmail}
                icon={EnvelopeIcon}
                placeholder={t.auth.emailPlaceholder}
                value={form.email}
                onChangeText={form.setEmail}
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
                testID="sign-in-password"
                label={t.auth.password}
                labelRight={
                  <TextLink size={13} label={t.auth.signIn.forgot} onPress={onForgotPassword} />
                }
                icon={LockKeyIcon}
                secure
                placeholder={t.auth.signIn.passwordPlaceholder}
                value={form.password}
                onChangeText={form.setPassword}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void form.submit()}
                inputRef={passwordRef}
              />
              <Button
                testID="sign-in-submit"
                className="mt-1"
                label={form.loading ? t.auth.signIn.submitting : t.auth.signIn.submit}
                loading={form.loading}
                disabled={!form.canSubmit}
                onPress={() => void form.submit()}
                icon={ArrowRightIcon}
              />
              <Text className="text-center text-[13.5px] leading-5 text-muted-foreground">
                {t.auth.signIn.socialHint}{" "}
                <Text className="font-semibold text-primary" onPress={onForgotPassword}>
                  {t.auth.signIn.socialHintLink}
                </Text>
              </Text>
            </View>
          </View>
          <View className="items-center px-6 pt-2 pb-safe">
            <View className="pb-4">
              <Text className="text-[14.5px] text-muted-foreground">
                {t.auth.signIn.newToApp}{" "}
                <Text className="font-bold text-primary" onPress={onCreateAccount}>
                  {t.auth.signIn.createTeam}
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
