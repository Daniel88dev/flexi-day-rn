// PROTOTYPE chrome: a collapsed pill at the top-left that opens the variant bar. Dev builds only.
import { getLocales } from "expo-localization";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useT } from "@/prototype/i18n";

export type Variant = { key: string; name: string };
export type Chip = { label: string; onPress: () => void };

const mono = { fontFamily: "Menlo", fontSize: 11, color: "#fff" } as const;

function ChipButton({ label, onPress }: Chip) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full bg-[#15131c] px-3 py-1.5 active:opacity-80"
    >
      <Text style={mono}>{label}</Text>
    </Pressable>
  );
}

export function Switcher({
  variants,
  current,
  chips = [],
}: {
  variants: Variant[];
  current: string;
  chips?: Chip[];
}) {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  if (!__DEV__) return null;
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  );
  const go = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    router.setParams({ variant: next.key });
  };
  const device = getLocales()[0]?.languageTag ?? "?";
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 top-0 pt-safe">
      <View className="mt-1 flex-row items-start gap-2 px-3">
        <Pressable
          onPress={() => setOpen((o) => !o)}
          hitSlop={6}
          className="rounded-full bg-[#15131c] px-3 py-1.5 active:opacity-80"
        >
          <Text style={mono}>
            {open ? "x" : `${current.toUpperCase()} ${variants[index].name}`}
          </Text>
        </Pressable>
        {open ? (
          <View className="flex-1 gap-1.5">
            <View className="flex-row flex-wrap gap-1.5">
              <ChipButton label={"‹ prev"} onPress={() => go(-1)} />
              <ChipButton
                label={`${current.toUpperCase()} ${variants[index].name}`}
                onPress={() => {}}
              />
              <ChipButton label={"next ›"} onPress={() => go(1)} />
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              <ChipButton
                label={`${locale.toUpperCase()} (device ${device})`}
                onPress={() => setLocale(locale === "en" ? "cs" : "en")}
              />
              {chips.map((chip) => (
                <ChipButton key={chip.label} {...chip} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
