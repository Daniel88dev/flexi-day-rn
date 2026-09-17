// Variant C "Editorial": small brand row up top, display headline low and left, big empty sky.
import { ArrowRightIcon } from "phosphor-react-native";
import { View } from "react-native";

import { useT } from "@/prototype/i18n";
import { Monogram } from "@/prototype/monogram";
import { Button, Notice, T, TextLink, Wordmark } from "@/prototype/ui";
import type { WelcomeProps } from "@/prototype/welcome/props";

export function WelcomeC({ notice, onSignIn, onCreate }: WelcomeProps) {
  const { t } = useT();
  return (
    <View className="flex-1 bg-background px-6 pt-safe pb-safe">
      <View className="mt-3 flex-row items-center gap-2.5">
        <Monogram size={28} />
        <Wordmark size={24} />
      </View>
      <View className="flex-1 justify-end pb-8">
        {notice ? (
          <View className="mb-6">
            <Notice tone="info" text={t.welcome.signedOut} />
          </View>
        ) : null}
        <T
          className="font-display text-[42px] leading-[46px] font-semibold text-foreground"
          style={{ letterSpacing: -1.2 }}
        >
          {t.welcome.headline}
        </T>
        <T className="mt-4 max-w-[320px] text-[17px] leading-6 text-muted-foreground">
          {t.welcome.tagline}
        </T>
      </View>
      <View className="gap-1 pb-3">
        <Button label={t.welcome.signIn} onPress={onSignIn} icon={ArrowRightIcon} />
        <TextLink
          label={t.welcome.createOnWeb}
          onPress={onCreate}
          external
          className="self-start py-4"
        />
      </View>
    </View>
  );
}
