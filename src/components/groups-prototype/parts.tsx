// PROTOTYPE (T-144, prototype/groups): shared pieces of the Groups design.
import { router, useLocalSearchParams } from "expo-router";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { CaretLeftIcon, CaretRightIcon, ShieldCheckIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

import { ROLE_LABEL, WEEKDAYS, type Role } from "./data";

export function ScreenHeader({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <View className="h-14 flex-row items-center justify-between gap-1 px-3">
      <View className="flex-1 flex-row items-center gap-1">
        <Pressable
          testID="stack-back"
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon icon={CaretLeftIcon} tone="foreground" size={22} weight="bold" />
        </Pressable>
        {title ? (
          <Text className="font-display text-[19px] font-semibold text-foreground">{title}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function Monogram({
  name,
  size = 44,
  muted = false,
}: {
  name: string;
  size?: number;
  muted?: boolean;
}) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.36 }}
      className={cn("items-center justify-center", muted ? "bg-muted" : "bg-accent")}
    >
      <Text
        style={{ fontSize: size * 0.36, letterSpacing: -0.3 }}
        className={cn("font-display font-bold", muted ? "text-muted-foreground" : "text-primary")}
      >
        {initialsOf(name) || "?"}
      </Text>
    </View>
  );
}

export function Pill({
  label,
  tone = "accent",
  icon,
}: {
  label: string;
  tone?: "accent" | "muted" | "warm";
  icon?: PhosphorIcon;
}) {
  const surface = { accent: "bg-accent", muted: "bg-muted", warm: "bg-warm-soft" }[tone];
  const text = { accent: "text-primary", muted: "text-muted-foreground", warm: "text-warm" }[tone];
  return (
    <View className={cn("flex-row items-center gap-1 rounded-full px-2.5 py-1", surface)}>
      {icon ? (
        <Icon
          icon={icon}
          tone={tone === "accent" ? "primary" : tone === "warm" ? "warm" : "muted"}
          size={12}
          weight="bold"
        />
      ) : null}
      <Text className={cn("text-[12px] font-semibold", text)}>{label}</Text>
    </View>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  if (!role) return null;
  return <Pill label={ROLE_LABEL[role]} />;
}

export function OrgAdminBadge() {
  return <Pill label="Org admin" tone="muted" icon={ShieldCheckIcon} />;
}

export function SectionHeading({
  title,
  meta,
  testID,
}: {
  title: string;
  meta?: string;
  testID?: string;
}) {
  return (
    <View testID={testID} className="flex-row items-baseline justify-between px-1 pb-2">
      <Text className="font-display text-[16px] font-semibold text-foreground">{title}</Text>
      {meta ? <Text className="text-[13px] text-faint">{meta}</Text> : null}
    </View>
  );
}

export function WeekdayPills({ days }: { days: number[] }) {
  const set = new Set(days);
  return (
    <View className="flex-row gap-1">
      {WEEKDAYS.map(({ day, label }) => {
        const on = set.has(day);
        return (
          <View
            key={day}
            className={cn(
              "h-7 w-7 items-center justify-center rounded-full",
              on ? "bg-primary" : "bg-muted"
            )}
          >
            <Text
              className={cn(
                "text-[12px] font-semibold",
                on ? "text-primary-foreground" : "text-faint"
              )}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="h-9 w-9 rounded-full bg-muted" />
      <View className="flex-1 gap-2">
        <View className="h-3.5 w-2/5 rounded-full bg-muted" />
        <View className="h-3 w-3/5 rounded-full bg-muted" />
      </View>
    </View>
  );
}

export function useVariant<T extends string>(variants: readonly T[]): T {
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  return (variants as readonly string[]).includes(variant ?? "") ? (variant as T) : variants[0];
}

export function useProtoState(): string | null {
  const { state } = useLocalSearchParams<{ state?: string }>();
  return state ?? null;
}

/** The prototype's variant bar: dev builds only, never part of the design being judged. */
export function VariantSwitcher({
  variants,
  names,
}: {
  variants: readonly string[];
  names: Record<string, string>;
}) {
  const current = useVariant(variants);
  const { bar } = useLocalSearchParams<{ bar?: string }>();
  if (!__DEV__ || bar === "off") return null;
  const index = variants.indexOf(current);
  const go = (delta: number) =>
    router.setParams({ variant: variants[(index + delta + variants.length) % variants.length] });
  return (
    <View
      pointerEvents="box-none"
      className="absolute right-0 bottom-0 left-0 items-center pb-safe"
    >
      <View
        className="mb-3 flex-row items-center gap-1 rounded-full px-1.5 py-1.5"
        style={{ backgroundColor: "#16151c" }}
      >
        <Pressable
          testID="proto-variant-prev"
          onPress={() => go(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous variant"
          className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
        >
          <CaretLeftIcon color="#fff" size={16} weight="bold" />
        </Pressable>
        <Text className="px-1 text-[13px] font-semibold" style={{ color: "#fff" }}>
          {current} {names[current]}
        </Text>
        <Pressable
          testID="proto-variant-next"
          onPress={() => go(1)}
          accessibilityRole="button"
          accessibilityLabel="Next variant"
          className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
        >
          <CaretRightIcon color="#fff" size={16} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}
