import { ArrowRightIcon } from "phosphor-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/text-link";
import { useTranslation } from "@/i18n/use-translation";
import type { SignedOutNotice } from "@/lib/session/signed-out-notice";

/** Where a phone with no session lands: the mark, one line about the product, one way on. */
export function Welcome({
  onSignIn,
  onCreateAccount,
  notice = null,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
  /** What the signed-out wipe left: shown until the next sign-in answers it. */
  notice?: SignedOutNotice | null;
}) {
  const { t } = useTranslation();
  return (
    <View testID="welcome" className="flex-1 bg-background pt-safe pb-safe">
      {/* The band the signed-out notice takes, held open so the mark sits where it does with one. */}
      <View className="min-h-[72px] px-6 pt-2">
        {notice ? (
          <Notice
            tone="accent"
            message={
              notice === "account-deleted"
                ? t.auth.welcome.accountDeleted
                : t.auth.welcome.signedOut
            }
          />
        ) : null}
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <LogoMark size={92} />
        <Wordmark size={46} className="mt-7" />
        <Text className="mt-4 max-w-[300px] text-center text-[17px] leading-6 text-muted-foreground">
          {t.auth.welcome.tagline}
        </Text>
      </View>
      <View className="gap-1 px-6 pb-3">
        <Button
          testID="welcome-sign-in"
          label={t.auth.welcome.signIn}
          onPress={onSignIn}
          icon={ArrowRightIcon}
        />
        <TextLink
          testID="welcome-create-account"
          label={t.auth.welcome.createOnWeb}
          onPress={onCreateAccount}
          external
          className="self-center py-4"
        />
      </View>
    </View>
  );
}
