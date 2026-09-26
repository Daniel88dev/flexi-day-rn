import { Pressable, View } from "react-native";

import { SendingBadge, StatusBadge, TypeBadge } from "@/components/requests/badges";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dayLengthLabel, runDatesLabel } from "@/lib/requests/format";
import type { RequestRun } from "@/lib/requests/runs";

/**
 * One run of the list. A pending change holding any of its days fades it and takes the tap away
 * until the change lifts, since the rows it would open are not the server's yet.
 */
export function RequestCard({
  run,
  viewerId,
  onPress,
}: {
  run: RequestRun;
  viewerId: string | null;
  onPress?: (run: RequestRun) => void;
}) {
  const { t } = useTranslation();
  const dates = runDatesLabel(run, t.requests.runDates);
  const person = run.userId === viewerId ? t.requests.you : run.userName;
  const who = [person, run.groupName].filter(Boolean).join(" · ");
  const length = dayLengthLabel(run, { halfDay: t.common.halfDay, fullDay: t.common.fullDay });

  return (
    <Pressable
      testID={`request-run-${run.id}`}
      onPress={onPress ? () => onPress(run) : undefined}
      disabled={run.pending}
      accessibilityRole="button"
      accessibilityState={{ disabled: run.pending }}
      accessibilityLabel={[dates, who, t.status[run.status]].join(", ")}
      style={run.pending ? { opacity: 0.55 } : undefined}
      className="gap-3 rounded-[24px] border border-border bg-card px-4 py-3.5 active:opacity-80"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display text-[17px] font-semibold text-foreground">{dates}</Text>
          <Text className="mt-0.5 text-[14px] text-muted-foreground" numberOfLines={1}>
            {who}
          </Text>
        </View>
        <StatusBadge status={run.status} />
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <TypeBadge type={run.vacationType} />
        <Text className="text-[13px] text-faint">
          {t.requests.dayCount(run.dayCount)} · {length}
        </Text>
        {run.pending ? <SendingBadge /> : null}
      </View>
    </Pressable>
  );
}
