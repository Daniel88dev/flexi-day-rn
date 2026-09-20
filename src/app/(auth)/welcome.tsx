import { router } from "expo-router";

import { Welcome } from "@/components/auth/welcome";
import { openWebPage, WEB_PATHS } from "@/lib/web";

export default function WelcomeScreen() {
  return (
    <Welcome
      onSignIn={() => router.push("/sign-in")}
      onCreateAccount={() => void openWebPage(WEB_PATHS.signUp)}
    />
  );
}
