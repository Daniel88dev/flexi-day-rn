// Variant C "Stack": no persistent frame at all. The dashboard is home, destinations are rows
// inside it that push a screen, the account sheet behind the avatar holds settings and sign-out,
// and the four stats are a hairline list rather than cards.
import { CaretLeftIcon, PlusIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import {
  Avatar,
  BottomSheet,
  CalendarSlot,
  Chevron,
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
import { Ic, T, useTone, Wordmark } from "@/prototype/ui";

function StatRow({ stat, last }: { stat: Stat; last: boolean }) {
  const tint = useTint(stat.id);
  return (
    <View
      className={
        last
          ? "flex-row items-center gap-3 py-3"
          : "flex-row items-center gap-3 border-b border-border py-3"
      }
    >
      <TintChip icon={stat.icon} color={tint} size={32} radius={10} glyph={17} />
      <View className="flex-1">
        <T className="text-[15px] font-semibold text-foreground">{stat.label}</T>
        <T className="text-[12.5px] text-faint">{stat.sub}</T>
      </View>
      <StatNumber value={stat.value} size={26} color={stat.accentValue ? tint : undefined} />
    </View>
  );
}

function DestinationRow({
  link,
  onPress,
}: {
  link: { label: string; icon: Parameters<typeof Ic>[0]["icon"] };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-[52px] flex-row items-center gap-3 border-b border-border active:opacity-70"
    >
      <Ic icon={link.icon} tone="muted" size={19} />
      <T className="flex-1 text-[15.5px] font-semibold text-foreground">{link.label}</T>
      <Chevron />
    </Pressable>
  );
}

export function ShellC({
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
  const [page, setPage] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const onPrimary = useTone("onPrimary");
  const pageLink = page ? findLink(sections, utility, page) : null;

  if (page) {
    return (
      <View className="flex-1 bg-background pt-safe pb-safe">
        <View className="mt-8 h-14 flex-row items-center gap-1 px-3">
          <Pressable
            onPress={() => setPage(null)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
          >
            <Ic icon={CaretLeftIcon} tone="foreground" size={22} weight="bold" />
          </Pressable>
          <T className="font-display text-[19px] font-semibold text-foreground">
            {pageLink?.label ?? page}
          </T>
        </View>
        <StubPage label={pageLink?.label ?? page} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      <View className="mt-8 h-12 flex-row items-center justify-between px-4">
        <Wordmark size={21} />
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => {}}
            accessibilityLabel={t.nav.newRequest}
            className="h-9 w-9 items-center justify-center rounded-full bg-primary active:opacity-90"
          >
            <PlusIcon color={onPrimary} size={18} weight="bold" />
          </Pressable>
          <Pressable
            onPress={() => setAccountOpen(true)}
            hitSlop={6}
            className="h-10 w-10 items-center justify-center"
          >
            <Avatar name={viewer.name} size={32} />
          </Pressable>
        </View>
      </View>

      <Refreshable onRefresh={onRefresh} paddingBottom={40}>
        <View className="gap-6 px-5 pt-2">
          <View>
            <Greeting viewer={viewer} size={34} />
            <SyncLine minutesAgo={syncedMinutesAgo} className="mt-2" />
          </View>

          {state === "empty" ? (
            <EmptyGroups onAction={() => {}} />
          ) : (
            <>
              <View>
                {stats.map((stat, index) => (
                  <StatRow key={stat.id} stat={stat} last={index === stats.length - 1} />
                ))}
              </View>
              <CalendarSlot height={220} />
            </>
          )}

          <View>
            {sections.map((section) => (
              <View key={section.id}>
                <SectionLabel>{section.label}</SectionLabel>
                {section.links
                  .filter((link) => link.key !== "dashboard")
                  .map((link) => (
                    <DestinationRow key={link.key} link={link} onPress={() => setPage(link.key)} />
                  ))}
              </View>
            ))}
          </View>
        </View>
      </Refreshable>

      <BottomSheet open={accountOpen} onClose={() => setAccountOpen(false)}>
        <ViewerBlock viewer={viewer} />
        <View className="my-2 h-px bg-border" />
        <View className="px-0">
          {utility.map((link) => (
            <NavRow
              key={link.key}
              link={link}
              active={false}
              onPress={() => {
                setAccountOpen(false);
                setPage(link.key);
              }}
            />
          ))}
          <SignOutRow onPress={onSignOut} />
        </View>
      </BottomSheet>
    </View>
  );
}
