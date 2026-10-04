// PROTOTYPE, throwaway. Four variants of the sign-in screen with Apple, Google and Microsoft
// buttons, rendered on the existing /sign-in route and switched from the floating bar at the
// bottom, which also flips EN/CS. Nothing here signs anyone in through a provider: a provider tap
// only shows the account_not_linked outcome so its copy and its place can be judged. The email
// form underneath is the real one.
import {
  AppleLogoIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  EnvelopeIcon,
  LockKeyIcon,
} from "phosphor-react-native";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { ScreenHeader } from "@/components/auth/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/text-link";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { useSignIn } from "@/lib/session/use-sign-in";
import { openWebPage } from "@/lib/web";

type Provider = "apple" | "google" | "microsoft";
const PROVIDERS: Provider[] = ["apple", "google", "microsoft"];
const PROVIDER_NAME: Record<Provider, string> = {
  apple: "Apple",
  google: "Google",
  microsoft: "Microsoft",
};

// Proposed copy, not yet in the dictionaries. Existing strings come from `t`.
const COPY = {
  en: {
    continueWith: {
      apple: "Continue with Apple",
      google: "Continue with Google",
      microsoft: "Continue with Microsoft",
    },
    orWithEmail: "or with email",
    orContinueWith: "or continue with",
    emailInstead: "Sign in with email instead",
    accountNotLinked: (provider: string) =>
      `That email already has a Flexi Day account with a password. Sign in with the password, then connect ${provider} from Settings on the web.`,
    openSettings: "Open Settings on the web",
    cancelled: "Sign-in was cancelled.",
    generic: "That sign-in could not be completed. Please try again.",
  },
  cs: {
    continueWith: {
      apple: "Pokračovat přes Apple",
      google: "Pokračovat přes Google",
      microsoft: "Pokračovat přes Microsoft",
    },
    orWithEmail: "nebo e-mailem",
    orContinueWith: "nebo pokračujte přes",
    emailInstead: "Přihlásit se e-mailem",
    accountNotLinked: (provider: string) =>
      `Tento e-mail už má účet Flexi Day s heslem. Přihlaste se heslem a v Nastavení na webu si pak připojte i ${provider}.`,
    openSettings: "Otevřít Nastavení na webu",
    cancelled: "Přihlášení bylo zrušeno.",
    generic: "Přihlášení se nepodařilo dokončit. Zkuste to prosím znovu.",
  },
} as const;

const VARIANTS = [
  { key: "A", name: "Providers first (web order)" },
  { key: "B", name: "Email first, providers below" },
  { key: "C", name: "Email first, icon row" },
  { key: "D", name: "Providers only, email folded" },
] as const;

// Survives Fast Refresh so an edit does not reset the view being judged.
let lastVariant = 0;
let lastNotice: Provider | null = null;

export type SignInSocialPrototypeProps = {
  onBack: () => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
};

export function SignInSocialPrototype(props: SignInSocialPrototypeProps) {
  const { locale, setLocale } = useTranslation();
  const [variant, setVariant] = useState(lastVariant);
  const [notice, setNotice] = useState<Provider | null>(lastNotice);
  const copy = COPY[locale];

  const pick = (index: number) => {
    lastVariant = (index + VARIANTS.length) % VARIANTS.length;
    setVariant(lastVariant);
  };
  const tapProvider = (provider: Provider) => {
    lastNotice = lastNotice === provider ? null : provider;
    setNotice(lastNotice);
  };

  const shared = { ...props, copy, notice, onProvider: tapProvider };
  const current = VARIANTS[variant];

  return (
    <View className="flex-1">
      {current.key === "A" ? <VariantA {...shared} /> : null}
      {current.key === "B" ? <VariantB {...shared} /> : null}
      {current.key === "C" ? <VariantC {...shared} /> : null}
      {current.key === "D" ? <VariantD {...shared} /> : null}
      {__DEV__ ? (
        <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 items-center pb-safe">
          <View className="elevation-4 mb-1 flex-row items-center gap-1 rounded-full bg-foreground py-1.5 pr-1.5 pl-3">
            <Pressable onPress={() => pick(variant - 1)} hitSlop={10} className="p-1">
              <CaretLeftIcon color="#fcf9f5" size={16} weight="bold" />
            </Pressable>
            <Text className="min-w-[180px] text-center text-[12px] font-semibold text-background">
              {current.key} · {current.name}
            </Text>
            <Pressable onPress={() => pick(variant + 1)} hitSlop={10} className="p-1">
              <CaretRightIcon color="#fcf9f5" size={16} weight="bold" />
            </Pressable>
            <Pressable
              onPress={() => setLocale(locale === "en" ? "cs" : "en")}
              hitSlop={10}
              className="ml-1 rounded-full bg-background px-2.5 py-1"
            >
              <Text className="text-[11px] font-bold text-foreground">{locale.toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

type Copy = (typeof COPY)[keyof typeof COPY];

type VariantProps = SignInSocialPrototypeProps & {
  copy: Copy;
  notice: Provider | null;
  onProvider: (provider: Provider) => void;
};

/* ---------------------------------------------------------------- building blocks */

function Shell({
  onBack,
  onCreateAccount,
  children,
}: {
  onBack: () => void;
  onCreateAccount: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View testID="sign-in" className="flex-1 bg-background pt-safe">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 64 }}
        >
          <ScreenHeader onBack={onBack} backLabel={t.auth.signIn.back} />
          <View className="flex-1 justify-center px-6 py-8">{children}</View>
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

function Title() {
  const { t } = useTranslation();
  return (
    <>
      <Text
        className="font-display text-[30px] font-semibold text-foreground"
        style={{ letterSpacing: -0.6 }}
      >
        {t.auth.signIn.title}
      </Text>
      <Text className="mt-2 text-[16px] leading-6 text-muted-foreground">
        {t.auth.signIn.description}
      </Text>
    </>
  );
}

/** The one error slot: the provider outcome when there is one, otherwise the form's own error. */
function ErrorSlot({
  copy,
  notice,
  formError,
}: Pick<VariantProps, "copy" | "notice"> & {
  formError: string | null;
}) {
  if (notice) {
    return (
      <Notice
        tone="error"
        message={copy.accountNotLinked(PROVIDER_NAME[notice])}
        action={{ label: copy.openSettings, onPress: () => void openWebPage("/settings/") }}
      />
    );
  }
  return formError ? <Notice tone="error" message={formError} /> : null;
}

function EmailForm({
  form,
  onForgotPassword,
}: {
  form: ReturnType<typeof useSignIn>;
  onForgotPassword: () => void;
}) {
  const { t } = useTranslation();
  const passwordRef = useRef<TextInput>(null);
  return (
    <>
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
        labelRight={<TextLink size={13} label={t.auth.signIn.forgot} onPress={onForgotPassword} />}
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
    </>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3.5">
      <View className="h-px flex-1 bg-border" />
      <Text className="text-[13px] text-faint">{label}</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}

/**
 * Apple's button follows Apple's own style (black in light, white in dark, the Apple logo) and
 * keeps the same height as every other button, as the Human Interface Guidelines require. Google
 * and Microsoft take the web's outlined style with their brand marks.
 */
function ProviderButton({
  provider,
  label,
  iconOnly,
  onPress,
}: {
  provider: Provider;
  label: string;
  iconOnly?: boolean;
  onPress: () => void;
}) {
  const dark = useColorScheme() === "dark";
  const base = cn(
    "h-14 flex-row items-center justify-center gap-2.5 rounded-full active:opacity-80",
    iconOnly ? "flex-1" : "w-full"
  );
  if (provider === "apple") {
    const fg = dark ? "#000000" : "#ffffff";
    return (
      <Pressable
        testID="sign-in-apple"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={base}
        style={{ backgroundColor: dark ? "#ffffff" : "#000000" }}
      >
        <AppleLogoIcon color={fg} size={iconOnly ? 24 : 20} weight="fill" />
        {iconOnly ? null : (
          <Text className="text-[16px] font-semibold" style={{ color: fg }}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      testID={`sign-in-${provider}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(base, "border border-input bg-card")}
    >
      {provider === "google" ? (
        <GoogleMark size={iconOnly ? 22 : 18} />
      ) : (
        <MicrosoftMark size={iconOnly ? 22 : 18} />
      )}
      {iconOnly ? null : <Text className="text-[16px] font-semibold text-foreground">{label}</Text>}
    </Pressable>
  );
}

function ProviderStack({ copy, onProvider }: Pick<VariantProps, "copy" | "onProvider">) {
  return (
    <View className="gap-3">
      {PROVIDERS.map((provider) => (
        <ProviderButton
          key={provider}
          provider={provider}
          label={copy.continueWith[provider]}
          onPress={() => onProvider(provider)}
        />
      ))}
    </View>
  );
}

function GoogleMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5 5 0 0 1-2.18 3.3v2.74h3.52c2.06-1.9 3.26-4.7 3.26-7.88z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.94 0 5.4-.97 7.2-2.63l-3.52-2.73c-.98.66-2.23 1.05-3.68 1.05-2.83 0-5.23-1.91-6.09-4.48H2.27v2.82A11 11 0 0 0 12 23z"
      />
      <Path fill="#FBBC05" d="M5.91 14.21a6.6 6.6 0 0 1 0-4.42V6.97H2.27a11 11 0 0 0 0 9.86z" />
      <Path
        fill="#EA4335"
        d="M12 5.5c1.6 0 3.03.55 4.16 1.62l3.12-3.12C17.4 2.2 14.94 1.2 12 1.2A11 11 0 0 0 2.27 6.97l3.64 2.82C6.77 7.4 9.17 5.5 12 5.5z"
      />
    </Svg>
  );
}

function MicrosoftMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x="4" y="4" width="43" height="43" fill="#F25022" />
      <Rect x="53" y="4" width="43" height="43" fill="#7FBA00" />
      <Rect x="4" y="53" width="43" height="43" fill="#00A4EF" />
      <Rect x="53" y="53" width="43" height="43" fill="#FFB900" />
    </Svg>
  );
}

/* ---------------------------------------------------------------- variants */

/** A: the web's order. Providers first, a divider, then the email form. */
function VariantA(props: VariantProps) {
  const form = useSignIn();
  return (
    <Shell onBack={props.onBack} onCreateAccount={props.onCreateAccount}>
      <Title />
      <View className="mt-7 gap-5">
        <ErrorSlot copy={props.copy} notice={props.notice} formError={form.error} />
        <ProviderStack copy={props.copy} onProvider={props.onProvider} />
        <Divider label={props.copy.orWithEmail} />
        <View className="gap-4">
          <EmailForm form={form} onForgotPassword={props.onForgotPassword} />
        </View>
      </View>
    </Shell>
  );
}

/** B: today's screen kept whole, the providers stacked under a divider where the hint was. */
function VariantB(props: VariantProps) {
  const form = useSignIn();
  return (
    <Shell onBack={props.onBack} onCreateAccount={props.onCreateAccount}>
      <Title />
      <View className="mt-7 gap-4">
        <ErrorSlot copy={props.copy} notice={props.notice} formError={form.error} />
        <EmailForm form={form} onForgotPassword={props.onForgotPassword} />
        <View className="mt-2 gap-4">
          <Divider label={props.copy.orContinueWith} />
          <ProviderStack copy={props.copy} onProvider={props.onProvider} />
        </View>
      </View>
    </Shell>
  );
}

/** C: today's screen, the providers as one row of three equal logo buttons. */
function VariantC(props: VariantProps) {
  const form = useSignIn();
  return (
    <Shell onBack={props.onBack} onCreateAccount={props.onCreateAccount}>
      <Title />
      <View className="mt-7 gap-4">
        <ErrorSlot copy={props.copy} notice={props.notice} formError={form.error} />
        <EmailForm form={form} onForgotPassword={props.onForgotPassword} />
        <View className="mt-2 gap-4">
          <Divider label={props.copy.orContinueWith} />
          <View className="flex-row gap-3">
            {PROVIDERS.map((provider) => (
              <ProviderButton
                key={provider}
                provider={provider}
                label={props.copy.continueWith[provider]}
                iconOnly
                onPress={() => props.onProvider(provider)}
              />
            ))}
          </View>
        </View>
      </View>
    </Shell>
  );
}

/** D: providers are the way in; the email form unfolds behind one link. */
function VariantD(props: VariantProps) {
  const form = useSignIn();
  const { t } = useTranslation();
  const [emailOpen, setEmailOpen] = useState(false);
  return (
    <Shell onBack={props.onBack} onCreateAccount={props.onCreateAccount}>
      <Title />
      <View className="mt-7 gap-5">
        <ErrorSlot copy={props.copy} notice={props.notice} formError={form.error} />
        <ProviderStack copy={props.copy} onProvider={props.onProvider} />
        {emailOpen ? (
          <View className="gap-4">
            <Divider label={props.copy.orWithEmail} />
            <EmailForm form={form} onForgotPassword={props.onForgotPassword} />
          </View>
        ) : (
          <View className="items-center">
            <TextLink
              testID="sign-in-email-instead"
              label={props.copy.emailInstead}
              onPress={() => setEmailOpen(true)}
              className="py-2"
            />
            <Text className="text-[13px] text-faint">{t.auth.signIn.forgot}</Text>
          </View>
        )}
      </View>
    </Shell>
  );
}
