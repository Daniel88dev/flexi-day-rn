// PROTOTYPE. Three variants of the welcome screen, switched by ?variant=, see issue 23.
import { router, useLocalSearchParams } from "expo-router";

import { Switcher, type Variant } from "@/prototype/switcher";
import type { Halo } from "@/prototype/ui";
import { openWeb } from "@/prototype/web";
import { WelcomeA } from "@/prototype/welcome/a";
import { WelcomeB } from "@/prototype/welcome/b";
import { WelcomeC } from "@/prototype/welcome/c";
import type { WelcomeProps } from "@/prototype/welcome/props";

const VARIANTS: Variant[] = [
  { key: "a", name: "Poster" },
  { key: "b", name: "Panel" },
  { key: "c", name: "Editorial" },
];
const HALOS: Halo[] = ["inline", "token", "mix"];

export default function WelcomeRoute() {
  const params = useLocalSearchParams<{ variant?: string; notice?: string; halo?: string }>();
  const variant = VARIANTS.some((v) => v.key === params.variant) ? params.variant! : "a";
  const notice = params.notice === "1";
  const halo = HALOS.includes(params.halo as Halo) ? (params.halo as Halo) : "inline";
  const props: WelcomeProps = {
    notice,
    halo,
    onSignIn: () => router.push({ pathname: "/prototype/sign-in", params: { variant } }),
    onCreate: () => openWeb("/sign-up/"),
  };
  const Screen = variant === "b" ? WelcomeB : variant === "c" ? WelcomeC : WelcomeA;
  return (
    <>
      <Screen {...props} />
      <Switcher
        variants={VARIANTS}
        current={variant}
        chips={[
          {
            label: `notice ${notice ? "on" : "off"}`,
            onPress: () => router.setParams({ notice: notice ? "0" : "1" }),
          },
          {
            label: `halo ${halo}`,
            onPress: () =>
              router.setParams({ halo: HALOS[(HALOS.indexOf(halo) + 1) % HALOS.length] }),
          },
        ]}
      />
    </>
  );
}
