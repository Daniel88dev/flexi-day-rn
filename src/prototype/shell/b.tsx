// Variant B "Drawer": the web's sidebar ported whole. No bottom bar; a drawer holds every
// destination in its sections, the viewer block and sign-out sit in its footer, and the four
// stats keep the web's StatCard shape two-up.
import { BellIcon, ListIcon, PlusIcon } from "phosphor-react-native";
import { useState } from "react";
import { Animated, Dimensions, PanResponder, Pressable, ScrollView, View } from "react-native";

import {
  CalendarSlot,
  EmptyGroups,
  Greeting,
  NavRow,
  Refreshable,
  SectionLabel,
  SignOutRow,
  StatNumber,
  StubPage,
  SyncLine,
  TintChip,
  useStats,
  useTint,
  ViewerBlock,
  type Stat,
} from "@/prototype/shell/chrome";
import { buildSections, buildUtility, findLink } from "@/prototype/shell/nav";
import type { ShellProps } from "@/prototype/shell/props";
import { useShellT } from "@/prototype/shell/strings";
import { Ic, LogoMark, T, useTone, Wordmark } from "@/prototype/ui";

const WIDTH = Dimensions.get("window").width;
const DRAWER = Math.min(320, WIDTH * 0.84);

function StatCard({ stat }: { stat: Stat }) {
  const tint = useTint(stat.id);
  return (
    <View className="flex-1 gap-3 rounded-3xl border border-border bg-card p-4">
      <View className="flex-row items-start justify-between">
        <T className="flex-1 pr-2 text-[13.5px] font-semibold text-muted-foreground">
          {stat.label}
        </T>
        <TintChip icon={stat.icon} color={tint} size={34} radius={10} glyph={18} />
      </View>
      <View className="flex-row items-baseline gap-1.5">
        <StatNumber value={stat.value} size={34} color={stat.accentValue ? tint : undefined} />
        <T className="flex-1 text-[12.5px] text-faint" numberOfLines={2}>
          {stat.sub}
        </T>
      </View>
    </View>
  );
}

export function ShellB({
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
  const [active, setActive] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [slide] = useState(() => new Animated.Value(0));
  const onPrimary = useTone("onPrimary");
  const activeLink = findLink(sections, utility, active);

  const animate = (to: number) => {
    setOpen(to === 1);
    Animated.timing(slide, { toValue: to, duration: 220, useNativeDriver: true }).start();
  };

  // Edge swipe, so the drawer is reachable with a thumb and not only from the header button.
  const [edge] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dy) < 12,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 40) animate(1);
      },
    })
  );

  const go = (key: string) => {
    setActive(key);
    animate(0);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 pt-safe">
        <View className="mt-8 h-14 flex-row items-center justify-between px-3">
          <Pressable
            onPress={() => animate(1)}
            hitSlop={8}
            accessibilityLabel={t.nav.menu}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
          >
            <Ic icon={ListIcon} tone="foreground" size={24} />
          </Pressable>
          <View className="flex-row items-center gap-2">
            <LogoMark size={22} />
            <Wordmark size={21} />
          </View>
          <Pressable hitSlop={8} className="h-10 w-10 items-center justify-center">
            <Ic icon={BellIcon} tone="muted" size={22} />
          </Pressable>
        </View>

        {active === "dashboard" ? (
          <Refreshable onRefresh={onRefresh} paddingBottom={40}>
            <View className="gap-5 px-4 pt-2">
              <View>
                <Greeting viewer={viewer} size={34} />
                <View className="mt-2 flex-row items-center justify-between">
                  <SyncLine minutesAgo={syncedMinutesAgo} />
                  <T className="text-[12.5px] text-faint">
                    {t.dashboard.teammates(viewer.teamSize)}
                  </T>
                </View>
              </View>
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <StatCard stat={stats[0]} />
                  <StatCard stat={stats[1]} />
                </View>
                <View className="flex-row gap-3">
                  <StatCard stat={stats[2]} />
                  <StatCard stat={stats[3]} />
                </View>
              </View>
              {state === "empty" ? <EmptyGroups onAction={() => {}} /> : <CalendarSlot />}
            </View>
          </Refreshable>
        ) : (
          <StubPage label={activeLink?.label ?? active} />
        )}
      </View>

      <View
        {...edge.panHandlers}
        pointerEvents={open ? "none" : "auto"}
        className="absolute top-0 bottom-0 left-0 w-6"
      />

      {open ? (
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.38)" }}
          onPress={() => animate(0)}
        />
      ) : null}

      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: DRAWER,
          transform: [
            { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER, 0] }) },
          ],
        }}
      >
        <View className="flex-1 border-r border-border bg-card pt-safe pb-safe">
          <View className="mt-8 flex-row items-center gap-2 px-4 pt-3 pb-2">
            <LogoMark size={24} />
            <Wordmark size={22} />
          </View>
          <Pressable
            onPress={() => {}}
            className="mx-3 mt-1 h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-90"
          >
            <PlusIcon color={onPrimary} size={18} weight="bold" />
            <T className="text-[15px] font-semibold text-primary-foreground">{t.nav.newRequest}</T>
          </Pressable>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 8 }}>
            <View className="px-2">
              {sections.map((section) => (
                <View key={section.id}>
                  <SectionLabel>{section.label}</SectionLabel>
                  {section.links.map((link) => (
                    <NavRow
                      key={link.key}
                      link={link}
                      active={link.key === active}
                      onPress={() => go(link.key)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          <View className="border-t border-border px-2 pt-2">
            {utility.map((link) => (
              <NavRow
                key={link.key}
                link={link}
                active={link.key === active}
                onPress={() => go(link.key)}
              />
            ))}
            <SignOutRow onPress={onSignOut} />
            <ViewerBlock viewer={viewer} compact />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
