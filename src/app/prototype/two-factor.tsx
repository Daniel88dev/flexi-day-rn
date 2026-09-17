// PROTOTYPE. Three variants of the two-factor screen, switched by ?variant=, see issue 23.
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert } from "react-native";

import type { TwoFactorMethod } from "@/prototype/stub-auth";
import { Switcher, type Variant } from "@/prototype/switcher";
import { TwoFactorA } from "@/prototype/two-factor/a";
import { TwoFactorB } from "@/prototype/two-factor/b";
import { TwoFactorC } from "@/prototype/two-factor/c";
import type { TwoFactorProps } from "@/prototype/two-factor/props";
import type { TwoFactorPreset } from "@/prototype/use-two-factor";

const VARIANTS: Variant[] = [
  { key: "a", name: "Boxes" },
  { key: "b", name: "Segmented" },
  { key: "c", name: "List" },
];
const PRESETS: TwoFactorPreset[] = ["idle", "sent", "error", "dead"];
const METHOD_SETS = ["totp,otp", "otp", "totp"];

export default function TwoFactorRoute() {
  const params = useLocalSearchParams<{ variant?: string; state?: string; methods?: string }>();
  const variant = VARIANTS.some((v) => v.key === params.variant) ? params.variant! : "a";
  const preset = PRESETS.includes(params.state as TwoFactorPreset)
    ? (params.state as TwoFactorPreset)
    : "idle";
  const methodsKey = METHOD_SETS.includes(params.methods ?? "") ? params.methods! : "totp,otp";
  const methods = useMemo(() => methodsKey.split(",") as TwoFactorMethod[], [methodsKey]);
  const props: TwoFactorProps = {
    methods,
    preset,
    onBack: () => (router.canGoBack() ? router.back() : router.replace("/prototype/welcome")),
    onSuccess: () => Alert.alert("Signed in", "Stub. The dashboard would open here."),
  };
  const Screen = variant === "b" ? TwoFactorB : variant === "c" ? TwoFactorC : TwoFactorA;
  return (
    <>
      <Screen {...props} />
      <Switcher
        variants={VARIANTS}
        current={variant}
        chips={[
          {
            label: `methods ${methodsKey}`,
            onPress: () =>
              router.setParams({
                methods: METHOD_SETS[(METHOD_SETS.indexOf(methodsKey) + 1) % METHOD_SETS.length],
              }),
          },
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
