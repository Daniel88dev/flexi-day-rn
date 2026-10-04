import { router } from "expo-router";

import { SignInSocialPrototype } from "@/components/auth/sign-in-social-prototype";
import { openWebPage, WEB_PATHS } from "@/lib/web";

// PROTOTYPE: the route renders the social sign-in variants instead of the real screen.
export default function SignInScreen() {
  return (
    <SignInSocialPrototype
      onBack={() => router.back()}
      onForgotPassword={() => void openWebPage(WEB_PATHS.forgotPassword)}
      onCreateAccount={() => void openWebPage(WEB_PATHS.signUp)}
    />
  );
}
