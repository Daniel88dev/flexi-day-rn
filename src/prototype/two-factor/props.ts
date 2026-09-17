import type { TwoFactorMethod } from "@/prototype/stub-auth";
import type { TwoFactorPreset } from "@/prototype/use-two-factor";

export type TwoFactorProps = {
  methods: TwoFactorMethod[];
  preset: TwoFactorPreset;
  onBack: () => void;
  onSuccess: () => void;
};
