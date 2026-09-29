import { Redirect, useLocalSearchParams } from "expo-router";

import { DevSignIn } from "@/components/auth/dev-sign-in";
import { devSignInTarget } from "@/lib/session/dev-sign-in";

export default function DevSignInRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevSignInFromLink />;
}

function DevSignInFromLink() {
  const { ticket, to, ...strayParams } = useLocalSearchParams();
  return <DevSignIn ticket={ticket} to={devSignInTarget(to, strayParams)} />;
}
