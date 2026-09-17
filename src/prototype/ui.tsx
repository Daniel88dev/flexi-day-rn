// PROTOTYPE primitives. Rough ports of the web's auth components; rewrite when a variant wins.
import { useUnstableNativeVariable } from "nativewind";
import {
  ArrowUpRightIcon,
  CaretLeftIcon,
  EyeIcon,
  EyeSlashIcon,
  type Icon,
  type IconWeight,
} from "phosphor-react-native";
import { useRef, useState, type ReactNode, type Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
  type TextProps,
} from "react-native";

import { useT } from "@/prototype/i18n";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "faint" | "muted" | "foreground" | "primary" | "onPrimary" | "danger" | "ok";

const TONE_VAR: Record<Tone, string> = {
  faint: "--text-faint",
  muted: "--text-muted",
  foreground: "--text",
  primary: "--primary",
  onPrimary: "--primary-fg",
  danger: "--danger",
  ok: "--ok",
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
    ok: "#4d9462",
  },
  dark: {
    faint: "#7a7a81",
    muted: "#a4a3ab",
    foreground: "#f1f1f5",
    primary: "#8e86f1",
    onPrimary: "#0c0c15",
    danger: "#e1786f",
    ok: "#72ba85",
  },
};

export function useTone(tone: Tone): string {
  // Typed against the web build of react-native-css; the native build takes the name.
  const value = (useUnstableNativeVariable as unknown as (name: string) => unknown)(TONE_VAR[tone]);
  const scheme = useColorScheme();
  if (typeof value === "string") return value;
  return FALLBACK[scheme === "dark" ? "dark" : "light"][tone];
}

// Text has no inheritance on native, so every text node opts into the body face here.
export function T({ className, ...props }: TextProps & { className?: string }) {
  return <Text {...props} className={cn("font-sans", className)} />;
}

export function Ic({
  icon: Glyph,
  tone = "muted",
  size = 18,
  weight = "regular",
}: {
  icon: Icon;
  tone?: Tone;
  size?: number;
  weight?: IconWeight;
}) {
  const color = useTone(tone);
  return <Glyph color={color} size={size} weight={weight} />;
}

export type Halo = "mix" | "token" | "inline";

// The web mark: a dot with a paper gap and a thin primary ring, sitting on an 18 % halo.
// `halo` picks how the halo is painted so the NativeWind question from issue 19 gets an answer.
export function LogoMark({
  size = 26,
  invert = false,
  halo = "inline",
}: {
  size?: number;
  invert?: boolean;
  halo?: Halo;
}) {
  const dot = Math.round(size * 0.52);
  const primary = useTone(invert ? "onPrimary" : "primary");
  const fill = invert ? "bg-primary-foreground" : "bg-primary";
  const gap = invert ? "bg-primary" : "bg-background";
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      {halo === "mix" ? (
        <View
          className={cn(
            "absolute inset-0 rounded-full",
            invert ? "bg-primary-foreground/[0.18]" : "bg-primary/[0.18]"
          )}
        />
      ) : halo === "token" ? (
        <View className="absolute inset-0 rounded-full bg-accent" />
      ) : (
        <View
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: primary, opacity: 0.18 }}
        />
      )}
      <View
        style={{ width: dot + 9, height: dot + 9 }}
        className={cn("items-center justify-center rounded-full", fill)}
      >
        <View
          style={{ width: dot + 6, height: dot + 6 }}
          className={cn("items-center justify-center rounded-full", gap)}
        >
          <View style={{ width: dot, height: dot }} className={cn("rounded-full", fill)} />
        </View>
      </View>
    </View>
  );
}

export function Wordmark({
  size = 26,
  invert = false,
  className,
}: {
  size?: number;
  invert?: boolean;
  className?: string;
}) {
  return (
    <T
      className={cn(
        "font-display font-bold",
        invert ? "text-primary-foreground" : "text-foreground",
        className
      )}
      style={{ fontSize: size * 0.74, letterSpacing: -size * 0.74 * 0.03 }}
    >
      flexi
      <T
        className={cn(
          "font-display font-bold",
          invert ? "text-primary-foreground" : "text-primary"
        )}
      >
        day
      </T>
    </T>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  icon?: Icon;
  className?: string;
};

export function Button({
  label,
  onPress,
  tone = "primary",
  loading,
  disabled,
  icon,
  className,
}: ButtonProps) {
  const fg: Tone = tone === "primary" ? "onPrimary" : "foreground";
  const spinner = useTone(fg);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        "h-14 flex-row items-center justify-center gap-2 rounded-full px-6 active:opacity-90",
        tone === "primary" ? "bg-primary" : "border border-border bg-secondary",
        disabled && !loading && "opacity-50",
        className
      )}
    >
      {loading ? <ActivityIndicator color={spinner} /> : null}
      <T
        className={cn(
          "text-[16px] font-semibold",
          tone === "primary" ? "text-primary-foreground" : "text-foreground"
        )}
      >
        {label}
      </T>
      {icon && !loading ? <Ic icon={icon} tone={fg} size={18} weight="bold" /> : null}
    </Pressable>
  );
}

export function TextLink({
  label,
  onPress,
  external,
  disabled,
  size = 15,
  tone = "primary",
  className,
}: {
  label: string;
  onPress: () => void;
  external?: boolean;
  disabled?: boolean;
  size?: number;
  tone?: "primary" | "muted";
  className?: string;
}) {
  const color: Tone = disabled ? "faint" : tone === "primary" ? "primary" : "muted";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      className={cn("flex-row items-center gap-1", className)}
    >
      <T
        className={cn(
          "font-semibold",
          disabled ? "text-faint" : tone === "primary" ? "text-primary" : "text-muted-foreground"
        )}
        style={{ fontSize: size }}
      >
        {label}
      </T>
      {external ? <Ic icon={ArrowUpRightIcon} tone={color} size={size} weight="bold" /> : null}
    </Pressable>
  );
}

export function Notice({ tone, text }: { tone: "error" | "success" | "info"; text: string }) {
  return (
    <View
      className={cn(
        "rounded-2xl px-4 py-3",
        tone === "error" ? "bg-danger-soft" : tone === "success" ? "bg-ok-soft" : "bg-accent"
      )}
    >
      <T
        className={cn(
          "text-[14px] leading-5",
          tone === "error" ? "text-danger" : tone === "success" ? "text-ok" : "text-foreground"
        )}
      >
        {text}
      </T>
    </View>
  );
}

export function BackButton({ onPress, invert }: { onPress: () => void; invert?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className={cn(
        "h-10 w-10 items-center justify-center rounded-full",
        !invert && "bg-secondary"
      )}
      style={invert ? { backgroundColor: "rgba(255,255,255,0.18)" } : undefined}
    >
      <Ic icon={CaretLeftIcon} tone={invert ? "onPrimary" : "foreground"} size={20} weight="bold" />
    </Pressable>
  );
}

export function ScreenHeader({ onBack, invert }: { onBack: () => void; invert?: boolean }) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-2">
      <BackButton onPress={onBack} invert={invert} />
      <View className="flex-row items-center gap-2">
        <LogoMark size={24} invert={invert} />
        <Wordmark size={22} invert={invert} />
      </View>
      <View className="w-10" />
    </View>
  );
}

export type FieldLook = "box" | "line" | "sheet";

type FieldProps = TextInputProps & {
  label?: string;
  labelRight?: ReactNode;
  icon?: Icon;
  secure?: boolean;
  look?: FieldLook;
  inputRef?: Ref<TextInput>;
  className?: string;
};

export function Field({
  label,
  labelRight,
  icon,
  secure,
  look = "box",
  inputRef,
  className,
  onFocus,
  onBlur,
  ...props
}: FieldProps) {
  const { t } = useT();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secure));
  const faint = useTone("faint");
  const primary = useTone("primary");
  const frame =
    look === "box"
      ? cn(
          "h-[52px] flex-row items-center gap-3 rounded-[12px] border bg-card px-4",
          focused ? "border-primary" : "border-input"
        )
      : look === "sheet"
        ? cn(
            "h-14 flex-row items-center gap-3 rounded-2xl border bg-secondary px-4",
            focused ? "border-primary" : "border-transparent"
          )
        : cn(
            "h-[52px] flex-row items-center gap-3 border-b-2",
            focused ? "border-primary" : "border-input"
          );
  return (
    <View className={className}>
      {label || labelRight ? (
        <View className="mb-2 flex-row items-center justify-between">
          <T className="text-[13px] font-semibold text-muted-foreground">{label}</T>
          {labelRight}
        </View>
      ) : null}
      <View className={frame}>
        {icon ? <Ic icon={icon} tone={focused ? "primary" : "faint"} size={18} /> : null}
        <TextInput
          ref={inputRef}
          {...props}
          secureTextEntry={secure ? hidden : props.secureTextEntry}
          placeholderTextColor={faint}
          selectionColor={primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={cn(
            "flex-1 py-0 font-sans text-foreground",
            look === "line" ? "text-[18px]" : "text-[16px]"
          )}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityLabel={hidden ? t.signIn.showPassword : t.signIn.hidePassword}
          >
            <Ic icon={hidden ? EyeIcon : EyeSlashIcon} tone="faint" size={20} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Six boxes driven by one invisible input, so iOS's SMS / mail code autofill still lands.
export function CodeBoxes({
  value,
  onChange,
  onComplete,
  disabled,
  length = 6,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  length?: number;
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, "").slice(0, length);
  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      disabled={disabled}
      className={cn("flex-row gap-2.5", disabled && "opacity-50")}
    >
      {Array.from({ length }).map((_, i) => {
        const active = focused && !disabled && i === Math.min(digits.length, length - 1);
        return (
          <View
            key={i}
            className={cn(
              "h-16 flex-1 items-center justify-center rounded-[12px] border bg-card",
              active ? "border-2 border-primary" : "border-input"
            )}
          >
            <T className="font-display text-[26px] font-semibold text-foreground">
              {digits[i] ?? ""}
            </T>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={digits}
        onChangeText={(v) => {
          const next = v.replace(/\D/g, "").slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        editable={!disabled}
        autoFocus
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute h-px w-px opacity-0"
      />
    </Pressable>
  );
}
