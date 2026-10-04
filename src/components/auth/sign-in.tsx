import { ArrowRightIcon, EnvelopeIcon, LockKeyIcon } from "phosphor-react-native";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, TextInput, View } from "react-native";

import { ProviderButton } from "@/components/auth/provider-button";
import { ScreenHeader } from "@/components/auth/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/text-link";
import { useTranslation } from "@/i18n/use-translation";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/auth/providers";
import { heldInvite } from "@/lib/session/held-invite";
import { useSignIn } from "@/lib/session/use-sign-in";
import { useSocialSignIn } from "@/lib/session/use-social-sign-in";

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
  const social = useSocialSignIn();
  const passwordRef = useRef<TextInput>(null);
  const [emailOpen, setEmailOpen] = useState(() => Boolean(heldInvite()?.invitedEmail));
  const [lastTried, setLastTried] = useState<"email" | "social">("email");

  const busy = form.loading || social.pending !== null;

  const submitEmail = () => {
    if (social.pending) return;
    setLastTried("email");
    void form.submit();
  };
  const signInWith = (provider: SocialProvider) => {
    setLastTried("social");
    void social.signIn(provider);
  };

  const notice =
    lastTried === "social"
      ? social.notice
      : form.error
        ? { message: form.error, action: undefined }
        : null;

  return (
    <View testID="sign-in" className="flex-1 bg-background pt-safe">
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
            <View className="mt-7 gap-5">
              {notice ? (
                <Notice tone="error" message={notice.message} action={notice.action} />
              ) : null}
              <View className="gap-3">
                {SOCIAL_PROVIDERS.map((provider) => (
                  <ProviderButton
                    key={provider}
                    testID={`sign-in-${provider}`}
                    provider={provider}
                    label={t.auth.signIn.signInWith[provider]}
                    loading={social.pending === provider}
                    disabled={busy && social.pending !== provider}
                    onPress={() => signInWith(provider)}
                  />
                ))}
              </View>
              {emailOpen ? (
                <View className="gap-4">
                  <View className="flex-row items-center gap-3.5">
                    <View className="h-px flex-1 bg-border" />
                    <Text className="text-[13px] text-faint">{t.auth.signIn.orWithEmail}</Text>
                    <View className="h-px flex-1 bg-border" />
                  </View>
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
                    onSubmitEditing={submitEmail}
                    inputRef={passwordRef}
                  />
                  <Button
                    testID="sign-in-submit"
                    className="mt-1"
                    label={form.loading ? t.auth.signIn.submitting : t.auth.signIn.submit}
                    loading={form.loading}
                    disabled={!form.canSubmit || social.pending !== null}
                    onPress={submitEmail}
                    icon={ArrowRightIcon}
                  />
                </View>
              ) : (
                <View className="items-center">
                  <TextLink
                    testID="sign-in-email-instead"
                    label={t.auth.signIn.emailInstead}
                    onPress={() => setEmailOpen(true)}
                    className="py-2"
                  />
                </View>
              )}
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
