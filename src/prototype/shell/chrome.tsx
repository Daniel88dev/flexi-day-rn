// PROTOTYPE pieces shared by the three shells. Each frame composes them differently; the
// question is the frame, so anything a frame disagrees about lives in the frame, not here.
import {
  AirplaneTakeoffIcon,
  CalendarBlankIcon,
  CaretRightIcon,
  ClockIcon,
  SignOutIcon,
  UsersIcon,
  type Icon,
  type IconWeight,
} from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { useUnstableNativeVariable } from "nativewind";
import { Modal, Pressable, RefreshControl, ScrollView, useColorScheme, View } from "react-native";

import { useShellT, type ShellDictionary } from "@/prototype/shell/strings";
import type { ShellState, Viewer } from "@/prototype/shell/props";
import type { NavLink, NavSection } from "@/prototype/shell/nav";
import { cn, Ic, T, useTone } from "@/prototype/ui";

export type StatId = "pending" | "outToday" | "comingUp" | "workingToday";

const TINT_VAR: Record<StatId, string> = {
  pending: "--warm",
  outToday: "--c-vacation",
  comingUp: "--c-pto",
  workingToday: "--c-home",
};

// Only used if the runtime hands back something other than a colour string.
const TINT_FALLBACK: Record<"light" | "dark", Record<StatId, string>> = {
  light: {
    pending: "#cf7440",
    outToday: "#7364d9",
    comingUp: "#3f8fbb",
    workingToday: "#2f9b6e",
  },
  dark: {
    pending: "#e28b58",
    outToday: "#948ae8",
    comingUp: "#5eaad8",
    workingToday: "#4cbd8c",
  },
};

export function useTint(id: StatId): string {
  const value = (useUnstableNativeVariable as unknown as (name: string) => unknown)(TINT_VAR[id]);
  const scheme = useColorScheme();
  if (typeof value === "string") return value;
  return TINT_FALLBACK[scheme === "dark" ? "dark" : "light"][id];
}

export type Stat = {
  id: StatId;
  icon: Icon;
  label: string;
  sub: string;
  value: number;
  accentValue?: boolean;
};

/** The web dashboard's four stats. Empty state zeroes them, it does not hide them. */
export function useStats(state: ShellState): Stat[] {
  const t = useShellT();
  const on = state === "data";
  return [
    {
      id: "pending",
      icon: ClockIcon,
      label: t.dashboard.stats.pendingApprovals,
      sub: t.dashboard.stats.pendingApprovalsSub,
      value: on ? 3 : 0,
      accentValue: true,
    },
    {
      id: "outToday",
      icon: AirplaneTakeoffIcon,
      label: t.dashboard.stats.outToday,
      sub: t.dashboard.stats.outTodaySub,
      value: on ? 2 : 0,
    },
    {
      id: "comingUp",
      icon: CalendarBlankIcon,
      label: t.dashboard.stats.comingUp,
      sub: t.dashboard.stats.comingUpSub,
      value: on ? 7 : 0,
    },
    {
      id: "workingToday",
      icon: UsersIcon,
      label: t.dashboard.stats.workingToday,
      sub: t.dashboard.stats.workingTodaySub,
      value: on ? 9 : 0,
    },
  ];
}

/** A token-tinted icon chip. The tint is painted as an opaque layer at 14 %, never as an
    opacity modifier on the token: `bg-primary/[0.18]` paints nothing on the NativeWind RC. */
export function TintChip({
  icon: Glyph,
  color,
  size = 38,
  radius = 11,
  glyph = 20,
  weight = "regular",
}: {
  icon: Icon;
  color: string;
  size?: number;
  radius?: number;
  glyph?: number;
  weight?: IconWeight;
}) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: radius }}
      className="items-center justify-center overflow-hidden"
    >
      <View className="absolute inset-0" style={{ backgroundColor: color, opacity: 0.14 }} />
      <Glyph color={color} size={glyph} weight={weight} />
    </View>
  );
}

export function StatNumber({
  value,
  size,
  color,
}: {
  value: number;
  size: number;
  color?: string;
}) {
  return (
    <T
      className="font-display font-bold text-foreground"
      style={{ fontSize: size, letterSpacing: -size * 0.03, color }}
    >
      {value}
    </T>
  );
}

export function greetingKey(): keyof ShellDictionary["dashboard"]["greetings"] {
  const hour = new Date().getHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function Greeting({
  viewer,
  size = 30,
  showSubtitle = true,
}: {
  viewer: Viewer;
  size?: number;
  showSubtitle?: boolean;
}) {
  const t = useShellT();
  const first = viewer.name.split(" ")[0];
  return (
    <View>
      <T
        className="font-display font-semibold text-foreground"
        style={{ fontSize: size, letterSpacing: -size * 0.02 }}
      >
        {t.dashboard.greeting(t.dashboard.greetings[greetingKey()], first)}
      </T>
      {showSubtitle ? (
        <T className="mt-1 text-[15px] leading-5 text-muted-foreground">{t.dashboard.subtitle}</T>
      ) : null}
    </View>
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const primary = useTone("primary");
  const letters = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center overflow-hidden"
    >
      <View className="absolute inset-0" style={{ backgroundColor: primary, opacity: 0.16 }} />
      <T className="font-display font-bold text-primary" style={{ fontSize: size * 0.36 }}>
        {letters}
      </T>
    </View>
  );
}

export function Refreshable({
  onRefresh,
  children,
  paddingBottom = 32,
}: {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  paddingBottom?: number;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const primary = useTone("primary");
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={primary}
          onRefresh={async () => {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
          }}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

export function SyncLine({ minutesAgo, className }: { minutesAgo: number; className?: string }) {
  const t = useShellT();
  return (
    <T className={cn("text-[12.5px] text-faint", className)}>
      {minutesAgo < 1 ? t.sync.justNow : t.sync.minutesAgo(minutesAgo)}
    </T>
  );
}

/** The empty dashboard: no groups, so no calendar and no numbers worth reading. */
export function EmptyGroups({ onAction }: { onAction: () => void }) {
  const t = useShellT();
  return (
    <View className="items-center rounded-3xl border border-border bg-card px-6 py-8">
      <T className="font-display text-[19px] font-semibold text-foreground">
        {t.dashboard.empty.title}
      </T>
      <T className="mt-2 text-center text-[14.5px] leading-5 text-muted-foreground">
        {t.dashboard.empty.body}
      </T>
      <Pressable
        onPress={onAction}
        className="mt-5 h-11 flex-row items-center justify-center rounded-full bg-primary px-5 active:opacity-90"
      >
        <T className="text-[15px] font-semibold text-primary-foreground">
          {t.dashboard.empty.action}
        </T>
      </Pressable>
    </View>
  );
}

/** Where the month calendar goes once the first real page arrives. */
export function CalendarSlot({ height = 260 }: { height?: number }) {
  const t = useShellT();
  return (
    <View
      style={{ height }}
      className="items-center justify-center rounded-3xl border border-dashed border-border bg-card"
    >
      <T className="text-[14px] text-faint">{t.dashboard.calendarSoon}</T>
    </View>
  );
}

export function StubPage({ label }: { label: string }) {
  const t = useShellT();
  return (
    <View className="flex-1 items-center justify-center px-8">
      <T className="text-center text-[15px] text-faint">{t.dashboard.stub(label)}</T>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  if (!children) return null;
  return (
    <T className="px-3 pt-4 pb-1.5 text-[11px] font-bold tracking-[1px] text-faint uppercase">
      {children}
    </T>
  );
}

export function NavRow({
  link,
  active,
  onPress,
}: {
  link: NavLink;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "h-12 flex-row items-center gap-3 rounded-2xl px-3 active:opacity-70",
        active && "bg-accent"
      )}
    >
      <Ic icon={link.icon} tone={active ? "primary" : "muted"} size={20} />
      <T
        className={cn(
          "text-[15.5px] font-semibold",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        {link.label}
      </T>
    </Pressable>
  );
}

export function SignOutRow({ onPress }: { onPress: () => void }) {
  const t = useShellT();
  return (
    <Pressable
      onPress={onPress}
      className="h-12 flex-row items-center gap-3 rounded-2xl px-3 active:opacity-70"
    >
      <Ic icon={SignOutIcon} tone="danger" size={20} />
      <T className="text-[15.5px] font-semibold text-danger">{t.account.signOut}</T>
    </Pressable>
  );
}

export function ViewerBlock({ viewer, compact }: { viewer: Viewer; compact?: boolean }) {
  return (
    <View className="flex-row items-center gap-3 px-3 py-2">
      <Avatar name={viewer.name} size={compact ? 34 : 40} />
      <View className="flex-1">
        <T className="text-[14.5px] font-semibold text-foreground">{viewer.name}</T>
        <T className="text-[12.5px] text-faint" numberOfLines={1}>
          {viewer.email}
        </T>
      </View>
    </View>
  );
}

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.38)" }}
          onPress={onClose}
        />
        <View className="rounded-t-[28px] bg-card px-3 pt-2.5 pb-safe">
          <View className="mx-auto mb-2 h-1 w-9 rounded-full bg-border" />
          {children}
          <View className="h-5" />
        </View>
      </View>
    </Modal>
  );
}

export function SheetSection({
  section,
  active,
  onPress,
}: {
  section: NavSection;
  active: string;
  onPress: (key: string) => void;
}) {
  return (
    <View>
      <SectionLabel>{section.label}</SectionLabel>
      {section.links.map((link) => (
        <NavRow
          key={link.key}
          link={link}
          active={link.key === active}
          onPress={() => onPress(link.key)}
        />
      ))}
    </View>
  );
}

export function Chevron() {
  return <Ic icon={CaretRightIcon} tone="faint" size={16} weight="bold" />;
}
