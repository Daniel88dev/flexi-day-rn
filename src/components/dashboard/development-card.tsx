import { useEffect, useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useStoreRowCounts, useSyncStatus, type SyncStatus } from "@/lib/local-store";

const AGE_TICK_MS = 1_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, in the roughest unit that still says something. */
export function formatAge(ms: number): string {
  if (ms < MINUTE) return `${Math.max(0, Math.round(ms / 1000))}s`;
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  return `${Math.floor(ms / DAY)}d`;
}

function cursorLine(status: SyncStatus, now: number): string {
  const age =
    status.hasCursor && status.lastPulledAt
      ? `${formatAge(now - Date.parse(status.lastPulledAt))} old`
      : "none";
  return `Cursor ${age} · generation ${status.generation}`;
}

function pullLine(status: SyncStatus, now: number): string {
  if (status.inFlight) return "Syncing…";
  if (!status.lastPulledAt) return "Never pulled";
  return `Last pull ${formatAge(now - Date.parse(status.lastPulledAt))} ago`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const ticking = setInterval(() => setNow(Date.now()), AGE_TICK_MS);
    return () => clearInterval(ticking);
  }, []);
  return now;
}

function StoreReadout() {
  const status = useSyncStatus();
  const counts = useStoreRowCounts();
  const now = useNow();

  return (
    <View className="gap-1 rounded-2xl border border-dashed border-border bg-card px-4 py-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-display text-[13px] font-semibold text-foreground">Local store</Text>
        <Text className="text-[12px] text-muted-foreground">{pullLine(status, now)}</Text>
      </View>
      <Text className="text-[12px] text-muted-foreground">{cursorLine(status, now)}</Text>
      <Text className="text-[12px] text-muted-foreground">
        {status.lastError ? `Error: ${status.lastError}` : "No errors"}
      </Text>
      <View className="mt-1 gap-0.5">
        {Object.entries(counts).map(([table, rows]) => (
          <View key={table} className="flex-row justify-between">
            <Text className="text-[12px] text-muted-foreground">{table}</Text>
            <Text className="text-[12px] text-foreground tabular-nums">{rows}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The store's readout on the dashboard, for verifying a pull on the phone. Development only. */
export function DevelopmentCard() {
  if (!__DEV__) return null;
  return <StoreReadout />;
}
