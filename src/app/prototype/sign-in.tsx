// PROTOTYPE. Three variants of the sign-in screen, switched by ?variant=, see issue 23.
import { router, useLocalSearchParams } from "expo-router";

import { SignInA } from "@/prototype/sign-in/a";
import { SignInB } from "@/prototype/sign-in/b";
import { SignInC } from "@/prototype/sign-in/c";
import type { SignInProps } from "@/prototype/sign-in/props";
import { Switcher, type Variant } from "@/prototype/switcher";
import type { SignInPreset } from "@/prototype/use-sign-in";
import { openWeb } from "@/prototype/web";

const VARIANTS: Variant[] = [
  { key: "a", name: "Form" },
  { key: "b", name: "Sheet" },
  { key: "c", name: "Plain" },
];
const PRESETS: SignInPreset[] = ["idle", "loading", "error"];

export default function SignInRoute() {
  const params = useLocalSearchParams<{ variant?: string; state?: string }>();
  const variant = VARIANTS.some((v) => v.key === params.variant) ? params.variant! : "a";
  const preset = PRESETS.includes(params.state as SignInPreset)
    ? (params.state as SignInPreset)
    : "idle";
  const props: SignInProps = {
    preset,
    onBack: () => (router.canGoBack() ? router.back() : router.replace("/prototype/welcome")),
    onSuccess: () => router.replace({ pathname: "/prototype/shell", params: { variant } }),
    onTwoFactor: (methods) =>
      router.push({
        pathname: "/prototype/two-factor",
        params: { variant, methods: methods.join(",") },
      }),
    openWeb,
  };
  const Screen = variant === "b" ? SignInB : variant === "c" ? SignInC : SignInA;
  return (
    <>
      <Screen {...props} />
      <Switcher
        variants={VARIANTS}
        current={variant}
        chips={[
          {
            label: `state ${preset}`,
            onPress: () =>
              router.setParams({ state: PRESETS[(PRESETS.indexOf(preset) + 1) % PRESETS.length] }),
          },
        ]}
      />
    </>
  );
}
