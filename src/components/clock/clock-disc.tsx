import { WifiSlashIcon } from "phosphor-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Icon, useTone, type Tone } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { discFace, useClockRead, type ClockTone } from "@/lib/attendance";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";

import { GLYPHS } from "./glyphs";

const SLOT = {
  flex: 1,
  height: 50,
  alignItems: "center",
  justifyContent: "flex-end",
  paddingBottom: 6,
} as const;

const FILL: Record<ClockTone, { surface: string; glyph: Tone }> = {
  primary: { surface: "bg-primary", glyph: "onPrimary" },
  ok: { surface: "bg-ok", glyph: "onFill" },
  warm: { surface: "bg-warm", glyph: "onFill" },
  muted: { surface: "bg-muted", glyph: "faint" },
};

/**
 * The tab bar's centre slot, lifted half out of the bar on a ring of page background. Without an
 * Employment the slot stays, empty, so the tabs either side never shift.
 */
export function ClockDisc({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { view } = useClockRead();
  const now = useNow(10_000);
  const face = discFace(view, now, t);
  const fill = FILL[face?.tone ?? "primary"];
  const glyphColor = useTone(fill.glyph);

  if (!face) return <View style={SLOT} testID="clock-slot-empty" />;

  const Glyph = GLYPHS[face.glyph];
  return (
    <Pressable
      onPress={onPress}
      style={SLOT}
      testID="clock-disc"
      accessibilityRole="button"
      accessibilityLabel={t.clock.sheetTitle}
      accessibilityValue={{ text: face.label }}
    >
      <View className="-mt-[26px] rounded-full bg-background p-[5px]">
        <View
          className={cn("h-[54px] w-[54px] items-center justify-center rounded-full", fill.surface)}
        >
          {face.loading ? (
            <ActivityIndicator color={glyphColor} />
          ) : (
            <Glyph color={glyphColor} size={26} />
          )}
          {face.offline ? (
            <View
              testID="clock-disc-offline"
              className="absolute -top-1 -right-1 h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-card"
            >
              <Icon icon={WifiSlashIcon} tone="muted" size={11} weight="bold" />
            </View>
          ) : null}
        </View>
      </View>
      <Text
        className="text-[10px] font-semibold text-muted-foreground"
        style={TABULAR}
        numberOfLines={1}
      >
        {face.label}
      </Text>
    </Pressable>
  );
}
