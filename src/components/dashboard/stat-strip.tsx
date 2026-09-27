import {
  AirplaneTiltIcon,
  CalendarDotsIcon,
  CaretRightIcon,
  ClockIcon,
  UsersThreeIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Icon, type Tone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n/en";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { StatTile, StatTileId } from "@/lib/dashboard/stats";

type TileLook = {
  icon: PhosphorIcon;
  tone: Tone;
  soft: string;
  value: string;
  label: (t: Dictionary) => string;
  sub: (t: Dictionary) => string;
};

const LOOKS: Record<StatTileId, TileLook> = {
  pending: {
    icon: ClockIcon,
    tone: "warm",
    soft: "bg-warm-soft",
    value: "text-warm",
    label: (t) => t.dashboard.stats.pending,
    sub: (t) => t.dashboard.stats.pendingSub,
  },
  outToday: {
    icon: AirplaneTiltIcon,
    tone: "primary",
    soft: "bg-accent",
    value: "text-foreground",
    label: (t) => t.dashboard.stats.outToday,
    sub: (t) => t.dashboard.stats.outTodaySub,
  },
  comingUp: {
    icon: CalendarDotsIcon,
    tone: "muted",
    soft: "bg-muted",
    value: "text-foreground",
    label: (t) => t.dashboard.stats.comingUp,
    sub: (t) => t.dashboard.stats.comingUpSub,
  },
  workingToday: {
    icon: UsersThreeIcon,
    tone: "ok",
    soft: "bg-ok-soft",
    value: "text-foreground",
    label: (t) => t.dashboard.stats.workingToday,
    sub: (t) => t.dashboard.stats.workingTodaySub,
  },
};

function spokenValue(value: StatTile["value"], t: Dictionary): string {
  if (value === "loading") return t.dashboard.stats.loading;
  if (value === "unavailable") return t.dashboard.stats.noValueSpoken;
  return String(value);
}

function Tile({ tile, open, onPress }: { tile: StatTile; open: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const look = LOOKS[tile.id];
  return (
    <Pressable
      testID={`stat-${tile.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${look.label(t)}: ${spokenValue(tile.value, t)}`}
      accessibilityState={{ expanded: open, busy: tile.value === "loading" }}
      className={cn(
        "flex-1 items-center gap-1.5 rounded-[16px] border bg-card px-1 py-3 active:opacity-80",
        open ? "border-input" : "border-border"
      )}
    >
      <View className={cn("h-7 w-7 items-center justify-center rounded-[12px]", look.soft)}>
        <Icon icon={look.icon} tone={look.tone} size={18} weight="bold" />
      </View>
      {tile.value === "loading" ? (
        <View testID={`stat-${tile.id}-loading`} className="h-[27px] justify-center">
          <View className="h-3.5 w-6 rounded-full bg-muted" />
        </View>
      ) : (
        <Text
          testID={`stat-${tile.id}-value`}
          className={cn(
            "font-display text-[22px] font-bold tabular-nums",
            tile.value === "unavailable" ? "text-faint" : look.value
          )}
          style={{ letterSpacing: -0.6 }}
        >
          {tile.value === "unavailable" ? t.dashboard.stats.noValue : tile.value}
        </Text>
      )}
    </Pressable>
  );
}

function Panel({ tile, onViewRequests }: { tile: StatTile; onViewRequests: () => void }) {
  const { t } = useTranslation();
  const look = LOOKS[tile.id];
  return (
    <View
      testID="stat-panel"
      className="mt-2 flex-row items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-foreground">{look.label(t)}</Text>
        <Text className="text-[13px] text-faint">
          {tile.value === "loading"
            ? t.dashboard.stats.loading
            : tile.value === "unavailable"
              ? t.dashboard.stats.unreachable
              : `${tile.value} ${look.sub(t)}`}
        </Text>
      </View>
      {tile.linksToRequests ? (
        <Pressable
          testID="stat-panel-view-requests"
          onPress={onViewRequests}
          hitSlop={8}
          accessibilityRole="link"
          className="flex-row items-center gap-0.5 active:opacity-70"
        >
          <Text className="text-[13px] font-semibold text-primary">
            {t.dashboard.stats.viewRequests}
          </Text>
          <Icon icon={CaretRightIcon} tone="primary" size={13} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatStrip({
  tiles,
  onViewRequests,
}: {
  tiles: readonly StatTile[];
  onViewRequests: () => void;
}) {
  const [openId, setOpenId] = useState<StatTileId | null>(null);
  const open = tiles.find((tile) => tile.id === openId);

  return (
    <View testID="stat-strip">
      <View className="flex-row gap-2">
        {tiles.map((tile) => (
          <Tile
            key={tile.id}
            tile={tile}
            open={tile.id === openId}
            onPress={() => setOpenId(tile.id === openId ? null : tile.id)}
          />
        ))}
      </View>
      {open ? <Panel tile={open} onViewRequests={onViewRequests} /> : null}
    </View>
  );
}
