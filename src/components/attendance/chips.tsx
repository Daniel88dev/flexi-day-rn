import { NotebookIcon, type Icon as PhosphorIcon } from "phosphor-react-native";
import { StyleSheet, useColorScheme, View } from "react-native";

import { Icon, type Tone } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { formatSignedMinutes } from "@/lib/attendance";
import { cn } from "@/lib/cn";

const FLAG_TEXT: Record<Exclude<Tone, "onPrimary" | "onFill" | "card">, string> = {
  faint: "text-faint",
  muted: "text-muted-foreground",
  foreground: "text-foreground",
  primary: "text-primary",
  danger: "text-danger",
  ok: "text-ok",
  warm: "text-warm",
  review: "text-review",
};

export type FlagTone = keyof typeof FLAG_TEXT;

/** Something on a session or a day that asks for a look, coloured by what it means. */
export function Flag({
  icon,
  tone,
  label,
  testID,
}: {
  icon: PhosphorIcon;
  tone: FlagTone;
  label: string;
  testID?: string;
}) {
  return (
    <View testID={testID} className="flex-row items-center gap-1">
      <Icon icon={icon} tone={tone} size={14} weight="bold" />
      <Text className={cn("text-[12.5px] font-semibold", FLAG_TEXT[tone])}>{label}</Text>
    </View>
  );
}

/** Entered after the fact: a permanent fact rather than a flag, so a quiet outlined stamp. */
export function EnteredStamp({
  testID,
  compact = false,
  label,
}: {
  testID?: string;
  compact?: boolean;
  /** "Entered by X" where the history names who. */
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <View
      testID={testID}
      className={cn(
        "flex-row items-center gap-1 rounded-full border border-input bg-card py-0.5",
        compact ? "px-1.5" : "pr-2 pl-1.5"
      )}
    >
      <Icon icon={NotebookIcon} tone="muted" size={13} />
      {compact ? null : (
        <Text className="text-[12px] font-semibold text-muted-foreground">
          {label ?? t.attendance.entered}
        </Text>
      )}
    </View>
  );
}

export function BalanceChip({ minutes, testID }: { minutes: number; testID?: string }) {
  const over = minutes >= 0;
  return (
    <View
      testID={testID}
      className={cn("rounded-full px-2 py-0.5", over ? "bg-ok-soft" : "bg-danger-soft")}
    >
      <Text
        className={cn("text-[12.5px] font-semibold", over ? "text-ok" : "text-danger")}
        style={TABULAR}
      >
        {formatSignedMinutes(minutes)}
      </Text>
    </View>
  );
}

export function TagChip({ label, testID }: { label: string; testID?: string }) {
  return (
    <View testID={testID} className="rounded-full bg-muted px-2 py-0.5">
      <Text className="text-[12.5px] font-semibold text-muted-foreground">{label}</Text>
    </View>
  );
}

/**
 * The hatching of a day nobody owed, slanted like the web's `excludedSurface`. React Native 0.86
 * draws no repeating gradient, so one diagonal tile repeats through its `experimental_background*`
 * props (checked against 0.86); the ink is plain at a low opacity, since its gradient parser takes
 * no OKLCH token.
 */
export function Hatch() {
  const ink = useColorScheme() === "dark" ? "#ffffff" : "#000000";
  return (
    <View
      testID="hatch"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: 0.07,
          experimental_backgroundImage: `linear-gradient(-45deg, ${ink} 0%, ${ink} 7%, transparent 7%, transparent 50%, ${ink} 50%, ${ink} 57%, transparent 57%, transparent 100%)`,
          experimental_backgroundSize: "8px 8px",
          experimental_backgroundRepeat: "repeat",
        },
      ]}
    />
  );
}
