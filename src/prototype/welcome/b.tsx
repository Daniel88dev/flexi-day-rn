// Variant B "Panel": the web's violet brand panel on top, actions on paper below.
import { ArrowRightIcon, ArrowUpRightIcon, QuotesIcon } from "phosphor-react-native";
import { View } from "react-native";

import { useT } from "@/prototype/i18n";
import { Button, Ic, LogoMark, Notice, T, Wordmark } from "@/prototype/ui";
import type { WelcomeProps } from "@/prototype/welcome/props";

export function WelcomeB({ notice, halo, onSignIn, onCreate }: WelcomeProps) {
  const { t } = useT();
  return (
    <View className="flex-1 bg-background">
      <View className="rounded-b-[40px] bg-primary px-7 pt-safe pb-10" style={{ flex: 1.15 }}>
        <View className="mt-4 flex-row items-center gap-2.5">
          <LogoMark size={26} invert halo={halo} />
          <Wordmark size={26} invert />
        </View>
        <View className="flex-1 justify-end">
          <View className="opacity-60">
            <Ic icon={QuotesIcon} tone="onPrimary" size={36} weight="fill" />
          </View>
          <T className="mt-4 font-serif text-[34px] leading-[40px] text-primary-foreground italic">
            {t.welcome.quote}
          </T>
        </View>
      </View>
      <View className="flex-1 justify-between px-6 pt-6 pb-safe">
        <View>{notice ? <Notice tone="info" text={t.welcome.signedOut} /> : null}</View>
        <View className="gap-3 pb-3">
          <Button label={t.welcome.signIn} onPress={onSignIn} icon={ArrowRightIcon} />
          <Button
            tone="secondary"
            label={t.welcome.createOnWeb}
            onPress={onCreate}
            icon={ArrowUpRightIcon}
          />
        </View>
      </View>
    </View>
  );
}
