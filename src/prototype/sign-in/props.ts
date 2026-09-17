import type { TwoFactorMethod } from "@/prototype/stub-auth";
import type { SignInPreset } from "@/prototype/use-sign-in";

export type SignInProps = {
  preset: SignInPreset;
  onBack: () => void;
  onSuccess: () => void;
  onTwoFactor: (methods: TwoFactorMethod[]) => void;
  openWeb: (path: string) => void;
};
