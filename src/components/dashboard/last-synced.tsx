import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n/en";
import { useTranslation } from "@/i18n/use-translation";
import { useSyncStatus } from "@/lib/local-store";
import { ageMs, relativeAge } from "@/lib/relative-time";
import { useNow } from "@/lib/use-now";

const AGE_TICK_MS = 30_000;

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
