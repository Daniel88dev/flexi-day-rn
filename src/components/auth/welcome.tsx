import { ArrowRightIcon } from "phosphor-react-native";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";
import { TextLink } from "@/components/ui/text-link";
import { useTranslation } from "@/i18n/use-translation";

/** Where a phone with no session lands: the mark, one line about the product, one way on. */
export function Welcome({
  onSignIn,
  onCreateAccount,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      {/* The band the signed-out notice takes, held open so the mark sits where it does with one. */}
      <View className="min-h-[72px] px-6 pt-2" />
      <View className="flex-1 items-center justify-center px-8">
        <LogoMark size={92} />
        <Wordmark size={46} className="mt-7" />
        <Text className="mt-4 max-w-[300px] text-center text-[17px] leading-6 text-muted-foreground">
          {t.auth.welcome.tagline}
        </Text>
      </View>
      <View className="gap-1 px-6 pb-3">
        <Button label={t.auth.welcome.signIn} onPress={onSignIn} icon={ArrowRightIcon} />
        <TextLink
          label={t.auth.welcome.createOnWeb}
          onPress={onCreateAccount}
          external
          className="self-center py-4"
        />
      </View>
    </View>
  );
}
