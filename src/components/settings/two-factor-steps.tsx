import * as Clipboard from "expo-clipboard";
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  CheckIcon,
  CopyIcon,
  DeviceMobileIcon,
  EnvelopeSimpleIcon,
  ExportIcon,
  LockKeyOpenIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";

import { Button } from "@/components/ui/button";
import { CodeBoxes } from "@/components/ui/code-boxes";
import { Field } from "@/components/ui/field";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/text-link";
import { useTranslation } from "@/i18n/use-translation";
import { haptic } from "@/lib/haptics";
import { groupSecret } from "@/lib/session/two-factor-settings";

const MONO = { fontFamily: "Menlo" };

export function StepHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="gap-2">
      <Text
        className="font-display text-[26px] font-semibold text-foreground"
        style={{ letterSpacing: -0.5 }}
      >
        {title}
      </Text>
      {hint ? (
        <Text className="text-[15.5px] leading-[22px] text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}

/** A secondary action on the primary tint, sized for a row of two. */
function SoftButton({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon: PhosphorIcon;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-accent px-4 active:opacity-70"
    >
      <Icon icon={icon} tone="primary" size={17} weight="bold" />
      <Text className="text-[15px] font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}

/** Copies `text`, and says so on the button until the text changes. */
function useCopy(text: string) {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      haptic("success");
      setFailed(false);
      setCopiedText(text);
    } catch (cause: unknown) {
      console.error("Copying to the clipboard failed.", cause);
      setFailed(true);
    }
  };
  return { copy, copied: copiedText === text, failed };
}

export function PasswordStep({
  hint,
  password,
  onChange,
  error,
  submitLabel,
  destructive,
  busy,
  canSubmit,
  onSubmit,
}: {
  hint: string;
  password: string;
  onChange: (value: string) => void;
  error: string | null;
  submitLabel: string;
  destructive?: boolean;
  busy: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  const danger = useTone("danger");
  return (
    <View className="gap-5">
      <Text className="text-[15.5px] leading-[22px] text-muted-foreground">{hint}</Text>
      <Field
        testID="two-factor-password"
        label={copy.password}
        icon={LockKeyOpenIcon}
        secure
        placeholder={copy.passwordPlaceholder}
        value={password}
        onChangeText={onChange}
        error={error}
        autoComplete="current-password"
        textContentType="password"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Button
        testID="two-factor-continue"
        label={busy ? copy.working : submitLabel}
        loading={busy}
        disabled={!canSubmit}
        onPress={onSubmit}
        // Button's own bg-primary would win over a second bg class, so the colour goes inline.
        style={destructive ? { backgroundColor: danger } : undefined}
      />
    </View>
  );
}

export function BackupCodesStep({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  const text = codes.join("\n");
  const clipboard = useCopy(text);

  return (
    <View className="gap-5">
      <View
        testID="two-factor-backup-codes"
        className="flex-row flex-wrap rounded-[24px] bg-card px-5 py-4"
      >
        {codes.map((code) => (
          <Text
            key={code}
            selectable
            className="w-1/2 py-1.5 text-[16px] text-foreground"
            style={MONO}
          >
            {code}
          </Text>
        ))}
      </View>
      {clipboard.failed ? <Notice tone="error" message={copy.copyFailed} /> : null}
      <View className="flex-row gap-3">
        <SoftButton
          testID="two-factor-copy-codes"
          label={clipboard.copied ? copy.copied : copy.copy}
          icon={clipboard.copied ? CheckIcon : CopyIcon}
          onPress={() => void clipboard.copy()}
        />
        <SoftButton
          testID="two-factor-share-codes"
          label={copy.share}
          icon={ExportIcon}
          onPress={() => void Share.share({ message: text }).catch(() => undefined)}
        />
      </View>
      <Button testID="two-factor-codes-saved" label={copy.savedThem} onPress={onDone} />
    </View>
  );
}

function MethodOption({
  icon,
  title,
  hint,
  onPress,
  disabled,
  testID,
}: {
  icon: PhosphorIcon;
  title: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      className="flex-row items-center gap-3.5 rounded-[16px] bg-card px-4 py-4 active:opacity-70"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
        <Icon icon={icon} tone="primary" size={20} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15.5px] font-semibold text-foreground">{title}</Text>
        <Text className="text-[13.5px] leading-[19px] text-muted-foreground">{hint}</Text>
      </View>
      <Icon icon={CaretRightIcon} tone="faint" size={16} />
    </Pressable>
  );
}

export function MethodStep({
  busy,
  onAuthenticator,
  onEmail,
}: {
  busy: boolean;
  onAuthenticator: () => void;
  onEmail: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  return (
    <View className="gap-3">
      <MethodOption
        testID="two-factor-method-totp"
        icon={DeviceMobileIcon}
        title={copy.methodTotp}
        hint={copy.methodTotpHint}
        onPress={onAuthenticator}
        disabled={busy}
      />
      <MethodOption
        testID="two-factor-method-otp"
        icon={EnvelopeSimpleIcon}
        title={copy.methodOtp}
        hint={copy.methodOtpHint}
        onPress={onEmail}
        disabled={busy}
      />
    </View>
  );
}

/** Where the web shows a QR code: a link the phone's authenticator opens, and the key itself. */
export function AuthenticatorLink({ uri, secret }: { uri: string; secret: string | null }) {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  const [unopened, setUnopened] = useState(false);
  const clipboard = useCopy(secret ?? "");

  return (
    <View className="gap-3">
      <Pressable
        testID="two-factor-add-to-authenticator"
        onPress={() => {
          setUnopened(false);
          Linking.openURL(uri).catch(() => setUnopened(true));
        }}
        accessibilityRole="link"
        className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-accent px-5 active:opacity-70"
      >
        <Icon icon={ArrowSquareOutIcon} tone="primary" size={18} weight="bold" />
        <Text className="text-[15.5px] font-semibold text-primary">{copy.addToAuthenticator}</Text>
      </Pressable>
      {unopened ? <Notice tone="error" message={copy.noAuthenticator} /> : null}
      {secret ? (
        <View className="gap-2 rounded-[16px] bg-card px-4 py-3.5">
          <Text className="text-[13px] font-semibold text-muted-foreground">
            {copy.secretLabel}
          </Text>
          <View className="flex-row items-center gap-3">
            <Text
              testID="two-factor-secret"
              selectable
              className="flex-1 text-[15px] leading-[22px] text-foreground"
              style={MONO}
            >
              {groupSecret(secret)}
            </Text>
            <TextLink
              testID="two-factor-copy-secret"
              label={clipboard.copied ? copy.copied : copy.copyKey}
              onPress={() => void clipboard.copy()}
              size={14}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function CodeStep({
  code,
  onChange,
  error,
  info,
  busy,
  canVerify,
  onVerify,
  onResend,
}: {
  code: string;
  onChange: (code: string) => void;
  error: string | null;
  info: string | null;
  busy: boolean;
  canVerify: boolean;
  onVerify: (code?: string) => void;
  onResend?: () => void;
}) {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  return (
    <View className="gap-4">
      {info ? <Notice tone="success" message={info} /> : null}
      <CodeBoxes
        testID="two-factor-code"
        label={copy.code}
        value={code}
        onChange={onChange}
        onComplete={(complete) => onVerify(complete)}
        disabled={busy}
      />
      {error ? (
        <Text testID="two-factor-code-error" className="text-[13px] leading-[18px] text-danger">
          {error}
        </Text>
      ) : null}
      <Button
        testID="two-factor-verify"
        label={busy ? copy.verifying : copy.verify}
        loading={busy}
        disabled={!canVerify}
        onPress={() => onVerify()}
      />
      {onResend ? (
        <View className="items-center pt-1">
          <TextLink
            testID="two-factor-resend"
            label={copy.resend}
            onPress={onResend}
            disabled={busy}
          />
        </View>
      ) : null}
    </View>
  );
}

export function DoneStep({
  title,
  body,
  onDone,
}: {
  title: string;
  body: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View testID="two-factor-done" className="gap-6 pt-6">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-ok-soft">
        <Icon icon={CheckIcon} tone="ok" size={26} weight="bold" />
      </View>
      <StepHeading title={title} hint={body} />
      <Button testID="two-factor-finish" label={t.settings.twoFactor.done} onPress={onDone} />
    </View>
  );
}
