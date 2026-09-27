import {
  ClockIcon,
  CoffeeIcon,
  PlayIcon,
  SignInIcon,
  SignOutIcon,
  TimerIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import type { ClockGlyph } from "@/lib/attendance";

export const GLYPHS: Record<ClockGlyph, PhosphorIcon> = {
  timer: TimerIcon,
  clock: ClockIcon,
  play: PlayIcon,
  coffee: CoffeeIcon,
  "sign-in": SignInIcon,
  "sign-out": SignOutIcon,
};
