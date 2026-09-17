// Variant A "Poster": centred mark and wordmark, actions pinned to the bottom.
import { ArrowRightIcon } from "phosphor-react-native";
import { View } from "react-native";

import { useT } from "@/prototype/i18n";
import { Button, LogoMark, Notice, T, TextLink, Wordmark } from "@/prototype/ui";
import type { WelcomeProps } from "@/prototype/welcome/props";

export function WelcomeA({ notice, halo, onSignIn, onCreate }: WelcomeProps) {
  const { t } = useT();
  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      <View className="min-h-[72px] justify-center px-6 pt-2">
        {notice ? <Notice tone="info" text={t.welcome.signedOut} /> : null}
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <LogoMark size={92} halo={halo} />
        <Wordmark size={46} className="mt-7" />
        <T className="mt-4 max-w-[300px] text-center text-[17px] leading-6 text-muted-foreground">
          {t.welcome.tagline}
        </T>
      </View>
      <View className="gap-1 px-6 pb-3">
        <Button label={t.welcome.signIn} onPress={onSignIn} icon={ArrowRightIcon} />
        <TextLink
          label={t.welcome.createOnWeb}
          onPress={onCreate}
          external
          className="self-center py-4"
        />
      </View>
    </View>
  );
}
