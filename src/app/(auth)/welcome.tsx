import { router } from "expo-router";

import { Welcome } from "@/components/auth/welcome";
import { useSignedOutNotice } from "@/lib/session/signed-out-notice";
import { openWebPage, WEB_PATHS } from "@/lib/web";

export default function WelcomeScreen() {
  const notice = useSignedOutNotice();
  return (
    <Welcome
      notice={notice}
      onSignIn={() => router.push("/sign-in")}
      onCreateAccount={() => void openWebPage(WEB_PATHS.signUp)}
    />
  );
}
