import { router, useLocalSearchParams } from "expo-router";

import { TwoFactor } from "@/components/auth/two-factor";
import { parseTwoFactorMethods } from "@/lib/session/two-factor";

export default function TwoFactorScreen() {
  const { methods } = useLocalSearchParams<{ methods?: string }>();
  return (
    <TwoFactor methods={parseTwoFactorMethods(methods ?? null)} onBack={() => router.back()} />
  );
}
