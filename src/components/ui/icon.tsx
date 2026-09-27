import { useUnstableNativeVariable } from "nativewind";
import type { Icon as PhosphorIcon, IconWeight } from "phosphor-react-native";
import { useColorScheme } from "react-native";

export type Tone =
  | "faint"
  | "muted"
  | "foreground"
  | "primary"
  | "onPrimary"
  | "danger"
  | "ok"
  | "warm"
  | "review"
  | "onFill"
  | "card";

const TONE_VAR: Record<Tone, string> = {
  faint: "--text-faint",
  muted: "--text-muted",
  foreground: "--text",
  primary: "--primary",
  onPrimary: "--primary-fg",
  danger: "--danger",
  ok: "--ok",
  warm: "--warm",
  review: "--review",
  // Text on an ok or warm fill: the page background, as the prototype's disc and buttons use it.
  onFill: "--bg",
  card: "--card",
};

// Only used if the runtime hands back something other than a colour string.
const FALLBACK: Record<"light" | "dark", Record<Tone, string>> = {
  light: {
    faint: "#919199",
    muted: "#686870",
    foreground: "#24232b",
    primary: "#6a5ec6",
    onPrimary: "#fcf9f5",
    danger: "#c6514f",
    ok: "#2e8a57",
    warm: "#c86a3f",
    review: "#1e74b3",
    onFill: "#fbf8f3",
    card: "#fffdfa",
  },
  dark: {
    faint: "#7a7a81",
    muted: "#a4a3ab",
    foreground: "#f1f1f5",
    primary: "#8e86f1",
    onPrimary: "#0c0c15",
    danger: "#e1786f",
    ok: "#5fbb85",
    warm: "#e68d65",
    review: "#72b3e8",
    onFill: "#121118",
    card: "#1b1a22",
  },
};

/** A theme colour as a plain string, for the icon library and anything else `className` misses. */
export function useTone(tone: Tone): string {
  // Typed against the web build of react-native-css; the native build takes the name.
  const value = (useUnstableNativeVariable as unknown as (name: string) => unknown)(TONE_VAR[tone]);
  const scheme = useColorScheme();
  if (typeof value === "string") return value;
  return FALLBACK[scheme === "dark" ? "dark" : "light"][tone];
}

export function Icon({
  icon: Glyph,
  tone = "muted",
  size = 20,
  weight = "regular",
}: {
  icon: PhosphorIcon;
  tone?: Tone;
  size?: number;
  weight?: IconWeight;
}) {
  return <Glyph color={useTone(tone)} size={size} weight={weight} />;
}
