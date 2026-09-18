// Variant A "Tabs": the web's mobile shell ported. A bottom bar with the clock in the middle,
// everything else behind More, and the four stats as the web's tap-to-expand strip.
import { BellIcon, ListIcon, PlusIcon, TimerIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import {
  BottomSheet,
  CalendarSlot,
  EmptyGroups,
  Greeting,
  Refreshable,
  SheetSection,
  SignOutRow,
  StatNumber,
  StubPage,
  SyncLine,
  TintChip,
  useStats,
  useTint,
  ViewerBlock,
} from "@/prototype/shell/chrome";
import { buildSections, buildUtility, findLink, splitForBottomBar } from "@/prototype/shell/nav";
import type { ShellProps } from "@/prototype/shell/props";
import { useShellT } from "@/prototype/shell/strings";
import { cn, Ic, LogoMark, T, TextLink, useTone, Wordmark } from "@/prototype/ui";

function StatTile({
  id,
  icon,
  value,
  label,
  open,
  onPress,
  accentValue,
}: {
  id: Parameters<typeof useTint>[0];
  icon: Parameters<typeof TintChip>[0]["icon"];
  value: number;
  label: string;
  open: boolean;
  onPress: () => void;
  accentValue?: boolean;
}) {
  const tint = useTint(id);
  return (
    <Pressable
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      className="flex-1 items-center gap-1.5 overflow-hidden rounded-2xl border border-border bg-card py-3 active:opacity-80"
      style={{ borderColor: open ? tint : undefined }}
    >
      {open ? (
        <View className="absolute inset-0" style={{ backgroundColor: tint, opacity: 0.08 }} />
      ) : null}
      <TintChip icon={icon} color={tint} size={28} radius={9} glyph={16} />
      <StatNumber value={value} size={22} color={accentValue ? tint : undefined} />
    </Pressable>
  );
}

function StatStrip({ stats, state }: { stats: ReturnType<typeof useStats>; state: string }) {
  const t = useShellT();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = stats.find((stat) => stat.id === openId) ?? null;
  return (
    <View>
      <View className="flex-row gap-2">
        {stats.map((stat) => (
          <StatTile
            key={stat.id}
            id={stat.id}
            icon={stat.icon}
            value={stat.value}
            label={stat.label}
            accentValue={stat.accentValue}
            open={stat.id === openId}
            onPress={() => setOpenId(stat.id === openId ? null : stat.id)}
          />
        ))}
      </View>
      {open ? (
        <View className="mt-2 flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <View className="flex-1">
            <T className="text-[14px] font-semibold text-foreground">{open.label}</T>
            <T className="text-[13px] text-faint">{`${open.value} ${open.sub}`}</T>
          </View>
          {state === "data" ? (
            <TextLink label={t.dashboard.stats.viewRequests} onPress={() => {}} size={13} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Tab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: Parameters<typeof Ic>[0]["icon"];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center gap-1 pt-2">
      <Ic
        icon={icon}
        tone={active ? "primary" : "muted"}
        size={22}
        weight={active ? "fill" : "regular"}
      />
      <T
        className={cn(
          "text-[10.5px] font-semibold",
          active ? "text-primary" : "text-muted-foreground"
        )}
        numberOfLines={1}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function ShellA({
  viewer,
  role,
  state,
  syncedMinutesAgo,
  onRefresh,
  onSignOut,
}: ShellProps) {
  const t = useShellT();
  const stats = useStats(state);
  const sections = buildSections(t, role);
  const utility = buildUtility(t);
  const { bar, sheet } = splitForBottomBar(sections);
  const [active, setActive] = useState("dashboard");
  const [moreOpen, setMoreOpen] = useState(false);
  const onPrimary = useTone("onPrimary");
  const activeLink = findLink(sections, utility, active);

  const go = (key: string) => {
    setActive(key);
    setMoreOpen(false);
  };

  return (
    <View className="flex-1 bg-background pt-safe">
      <View className="mt-8 h-14 flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-2">
          <LogoMark size={24} />
          <Wordmark size={22} />
        </View>
        <Pressable hitSlop={8} className="h-10 w-10 items-center justify-center">
          <Ic icon={BellIcon} tone="muted" size={22} />
        </Pressable>
      </View>

      {active === "dashboard" ? (
        <Refreshable onRefresh={onRefresh} paddingBottom={24}>
          <View className="gap-5 px-4 pt-1">
            <View>
              <Greeting viewer={viewer} size={28} />
              <SyncLine minutesAgo={syncedMinutesAgo} className="mt-2" />
            </View>
            <StatStrip stats={stats} state={state} />
            {state === "empty" ? <EmptyGroups onAction={() => {}} /> : <CalendarSlot />}
          </View>
        </Refreshable>
      ) : (
        <StubPage label={activeLink?.label ?? active} />
      )}

      <View className="absolute right-4 bottom-[96px]">
        <Pressable
          className="h-14 w-14 items-center justify-center rounded-full bg-primary active:opacity-90"
          accessibilityLabel={t.nav.newRequest}
          onPress={() => {}}
        >
          <PlusIcon color={onPrimary} size={24} weight="bold" />
        </Pressable>
      </View>

      <View className="flex-row border-t border-border bg-card pb-safe">
        <Tab
          label={bar[0]?.label ?? ""}
          icon={bar[0]!.icon}
          active={active === bar[0]?.key}
          onPress={() => go(bar[0]!.key)}
        />
        <Tab
          label={bar[1]?.label ?? ""}
          icon={bar[1]!.icon}
          active={active === bar[1]?.key}
          onPress={() => go(bar[1]!.key)}
        />
        <View className="flex-1 items-center pt-1.5">
          <Pressable
            onPress={() => go("myAttendance")}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-90"
          >
            <TimerIcon color={onPrimary} size={22} />
          </Pressable>
          <T className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">{t.nav.clock}</T>
        </View>
        <Tab
          label={bar[2]?.label ?? ""}
          icon={bar[2]!.icon}
          active={active === bar[2]?.key}
          onPress={() => go(bar[2]!.key)}
        />
        <Tab
          label={t.nav.more}
          icon={ListIcon}
          active={moreOpen}
          onPress={() => setMoreOpen(true)}
        />
      </View>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        {sheet.map((section) => (
          <SheetSection key={section.id} section={section} active={active} onPress={go} />
        ))}
        <View className="my-2 h-px bg-border" />
        <SheetSection
          section={{ id: "organization", label: "", links: utility }}
          active={active}
          onPress={go}
        />
        <SignOutRow onPress={onSignOut} />
        <View className="mt-1 border-t border-border pt-1">
          <ViewerBlock viewer={viewer} compact />
        </View>
      </BottomSheet>
    </View>
  );
}
