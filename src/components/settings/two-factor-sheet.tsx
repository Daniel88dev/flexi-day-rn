import { Stack } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import {
  AuthenticatorLink,
  BackupCodesStep,
  CodeStep,
  DoneStep,
  MethodStep,
  PasswordStep,
  StepHeading,
} from "@/components/settings/two-factor-steps";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import type { TwoFactorFlow } from "@/lib/session/two-factor-settings";
import { useTwoFactorFlow } from "@/lib/session/use-two-factor-flow";

/** One two-factor flow as a page sheet, stepping through its screens in place. */
export function TwoFactorSheet({ flow, onClose }: { flow: TwoFactorFlow; onClose: () => void }) {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  const form = useTwoFactorFlow(flow);
  const { step } = form.state;

  const flowTitle = {
    enable: copy.enable,
    authenticator: copy.setupTotp,
    backupCodes: copy.regenerateBackup,
    disable: copy.disableTitle,
  }[flow];
  // Fresh codes have already replaced the old ones, so only "I saved them" may close the sheet.
  const mustConfirmCodes = flow === "backupCodes" && step === "backupCodes";
  const dismissable = !form.busy && !mustConfirmCodes;

  let body;
  if (step === "password") {
    body = (
      <PasswordStep
        hint={flow === "disable" ? `${copy.disableHint} ${copy.passwordHint}` : copy.passwordHint}
        password={form.password}
        onChange={form.setPassword}
        error={form.passwordError}
        submitLabel={flow === "disable" ? copy.disable : copy.continue}
        destructive={flow === "disable"}
        busy={form.busy}
        canSubmit={form.canSubmitPassword}
        onSubmit={() => void form.submitPassword()}
      />
    );
  } else if (step === "backupCodes") {
    body = (
      <>
        <StepHeading title={copy.backupTitle} hint={copy.backupHint} />
        <BackupCodesStep
          codes={form.state.backupCodes}
          // New backup codes ends on its codes, so saving them closes the sheet.
          onDone={flow === "backupCodes" ? onClose : form.saveCodes}
        />
      </>
    );
  } else if (step === "method") {
    body = (
      <>
        <StepHeading title={copy.methodTitle} />
        <MethodStep
          busy={form.busy}
          onAuthenticator={form.chooseAuthenticator}
          onEmail={() => void form.chooseEmail()}
        />
      </>
    );
  } else if (step === "authenticator" || step === "emailCode") {
    const authenticator = step === "authenticator";
    body = (
      <>
        <StepHeading
          title={authenticator ? copy.totpTitle : copy.otpTitle}
          hint={authenticator ? copy.totpHint : copy.otpHint}
        />
        {authenticator && form.state.totpURI ? (
          <AuthenticatorLink uri={form.state.totpURI} secret={form.secret} />
        ) : null}
        <CodeStep
          code={form.code}
          onChange={form.setCode}
          error={form.codeError}
          info={form.info}
          busy={form.busy}
          canVerify={form.canVerify}
          onVerify={(code) => void form.verify(code)}
          onResend={authenticator ? undefined : () => void form.resend()}
        />
      </>
    );
  } else {
    const [title, text] =
      flow === "disable"
        ? [copy.disabledTitle, copy.disabledBody]
        : flow === "authenticator"
          ? [copy.linkedTitle, copy.linkedBody]
          : [copy.enabledTitle, copy.enabledBody];
    body = <DoneStep title={title} body={text} onDone={onClose} />;
  }

  return (
    <View testID={`two-factor-${flow}`} className="flex-1 bg-background">
      <Stack.Screen options={{ gestureEnabled: dismissable }} />
      <View className="h-14 flex-row items-center border-b border-border px-2">
        <View className="min-w-[88px] items-start">
          {dismissable && step !== "done" ? (
            <Pressable
              testID="two-factor-cancel"
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              className="h-10 justify-center rounded-full px-3 active:opacity-70"
            >
              <Text className="text-[16px] text-primary">{copy.cancel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text
          className="font-display flex-1 text-center text-[17px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {flowTitle}
        </Text>
        <View className="min-w-[88px]" />
      </View>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // A padding KeyboardAvoidingView measures from the screen, not the page sheet.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: 20, padding: 20, paddingBottom: 48 }}
      >
        {form.error ? (
          <View testID="two-factor-error">
            <Notice tone="error" message={form.error} />
          </View>
        ) : null}
        <View className="gap-5">{body}</View>
      </ScrollView>
    </View>
  );
}
