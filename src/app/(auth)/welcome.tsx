import { router, type Href } from "expo-router";

import { Welcome } from "@/components/auth/welcome";
import { openWebPage } from "@/lib/web";

const SIGN_UP_PATH = "/sign-up/";

export default function WelcomeScreen() {
  return (
    <Welcome
      // The sign-in screen arrives with the next ticket; until then this lands on the
      // unmatched-route screen, which is why the typed route needs the cast.
      onSignIn={() => router.push("/sign-in" as Href)}
      onCreateAccount={() => void openWebPage(SIGN_UP_PATH)}
    />
  );
}
