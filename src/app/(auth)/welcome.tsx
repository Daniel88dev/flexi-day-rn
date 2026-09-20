import { router } from "expo-router";

import { Welcome } from "@/components/auth/welcome";
import { useSignedOutNotice } from "@/lib/session/signed-out-notice";
import { openWebPage, WEB_PATHS } from "@/lib/web";

export default function WelcomeScreen() {
  const signedOut = useSignedOutNotice();
  return (
    <Welcome
      signedOut={signedOut}
      onSignIn={() => router.push("/sign-in")}
      onCreateAccount={() => void openWebPage(WEB_PATHS.signUp)}
    />
  );
}
