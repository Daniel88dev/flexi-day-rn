import type { Halo } from "@/prototype/ui";

export type WelcomeProps = {
  notice: boolean;
  halo: Halo;
  onSignIn: () => void;
  onCreate: () => void;
};
