import { router } from "expo-router";

import { SignIn } from "@/components/auth/sign-in";
import { openWebPage, WEB_PATHS } from "@/lib/web";

export default function SignInScreen() {
  return (
    <SignIn
      onBack={() => router.back()}
      onForgotPassword={() => void openWebPage(WEB_PATHS.forgotPassword)}
      onCreateAccount={() => void openWebPage(WEB_PATHS.signUp)}
    />
  );
}
