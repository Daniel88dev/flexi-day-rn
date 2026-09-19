import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useStoreRowCounts, useSyncStatus, type SyncStatus } from "@/lib/local-store";
import { ageMs, roughAge, type AgeUnit } from "@/lib/relative-time";
import { useNow } from "@/lib/use-now";

const AGE_TICK_MS = 1_000;

const UNIT_SUFFIX: Record<AgeUnit, string> = {
  seconds: "s",
  minutes: "m",
  hours: "h",
  days: "d",
};

export function formatAge(ms: number): string {
  const { unit, value } = roughAge(ms);
  return `${value}${UNIT_SUFFIX[unit]}`;
}

function cursorLine(status: SyncStatus, now: number): string {
  const age =
    status.hasCursor && status.lastPulledAt
      ? `${formatAge(ageMs(status.lastPulledAt, now))} old`
      : "none";
  return `Cursor ${age} · generation ${status.generation}`;
}

function pullLine(status: SyncStatus, now: number): string {
  if (status.inFlight) return "Syncing…";
  if (!status.lastPulledAt) return "Never pulled";
  return `Last pull ${formatAge(ageMs(status.lastPulledAt, now))} ago`;
}

function StoreReadout() {
  const status = useSyncStatus();
  const counts = useStoreRowCounts();
  const now = useNow(AGE_TICK_MS);

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
