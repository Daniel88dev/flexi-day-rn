import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n/en";
import { useTranslation } from "@/i18n/use-translation";
import { useSyncStatus } from "@/lib/local-store";
import { ageMs, roughAge, type AgeUnit } from "@/lib/relative-time";
import { useNow } from "@/lib/use-now";

const AGE_TICK_MS = 30_000;

const AGE_COPY: Record<AgeUnit, (t: Dictionary, value: number) => string> = {
  seconds: (t) => t.sync.justNow,
  minutes: (t, value) => t.sync.minutesAgo(value),
  hours: (t, value) => t.sync.hoursAgo(value),
  days: (t, value) => t.sync.daysAgo(value),
};

export function relativeAge(ms: number, t: Dictionary): string {
  const { unit, value } = roughAge(ms);
  return AGE_COPY[unit](t, value);
}

function syncedLine(lastPulledAt: string | null, t: Dictionary, now: number): string {
  if (!lastPulledAt) return t.sync.never;
  return t.sync.lastSynced(relativeAge(ageMs(lastPulledAt, now), t));
}

/** How fresh what the dashboard shows is: the time of the last pull that finished. */
export function LastSynced() {
  const { t } = useTranslation();
  const { lastPulledAt } = useSyncStatus();
  const now = useNow(AGE_TICK_MS);

  return (
    <Text className="text-[12.5px] text-muted-foreground">{syncedLine(lastPulledAt, t, now)}</Text>
  );
}
