import { PlusIcon } from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { PersonAvatar } from "@/components/calendar/person-avatar";
import { StatusBadge } from "@/components/requests/badges";
import { Icon } from "@/components/ui/icon";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dayParts, type DayEntry } from "@/lib/calendar/day";
import { cn } from "@/lib/cn";
import { runDatesLabel } from "@/lib/requests/format";

function EntryRow({
  entry,
  viewerId,
  onOpen,
}: {
  entry: DayEntry;
  viewerId: string | null;
  onOpen?: (vacationId: string) => void;
}) {
  const { t } = useTranslation();
  const name = entry.userId === viewerId ? t.requests.you : (entry.userName ?? "?");
  const details = [
    t.recordTypes[entry.type],
    entry.halfDay ? t.common.halfDay : null,
    runDatesLabel(entry, t.requests.runDates),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      testID={`day-list-row-${entry.vacationId}`}
      onPress={onOpen ? () => onOpen(entry.vacationId) : undefined}
      accessibilityRole="button"
      accessibilityLabel={[name, details, t.status[entry.status]].join(", ")}
      className="flex-row items-center gap-3 rounded-[16px] px-2 py-2.5 active:bg-muted"
    >
      <View className={cn("h-8 w-[3px] rounded-full", LEAVE_CLASSES[entry.type].fill)} />
      <PersonAvatar userId={entry.userId} name={entry.userName} size={32} />
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
          {details}
        </Text>
      </View>
      {entry.status === "pending" ? <StatusBadge status="pending" /> : null}
    </Pressable>
  );
}

/** The lanes calendar shows this list in a sheet; the stripes calendar shows it inline. */
export function DayList({
  day,
  entries,
  holidays,
  viewerId,
  onOpen,
  onBook,
}: {
  day: string;
  entries: readonly DayEntry[];
  holidays: readonly string[];
  viewerId: string | null;
  onOpen?: (vacationId: string) => void;
  onBook: (day: string) => void;
}) {
  const { t } = useTranslation();
  const labels = t.dashboard.calendar;
  const { weekday, date } = dayParts(day);
  const title = t.calendar.dayTitle(weekday, date);

  return (
    <View testID="day-list" className="shrink">
      <View className="px-5 pt-1 pb-2">
        <Text className="font-display text-[18px] font-semibold text-foreground">{title}</Text>
        <Text className="text-[13px] text-faint">
          {entries.length === 0 ? labels.nobodyAway : labels.awayCount(entries.length)}
        </Text>
      </View>
      <ScrollView className="shrink px-3">
        {holidays.map((name) => (
          <View
            key={name}
            className="mb-1 flex-row items-center gap-3 overflow-hidden rounded-[16px] px-3 py-3"
          >
            <View className="absolute inset-0 bg-leave-bank" style={{ opacity: 0.16 }} />
            <View className="h-[11px] w-[11px] rounded-full bg-leave-bank" />
            <Text className="flex-1 text-[15px] font-semibold text-leave-bank">{name}</Text>
          </View>
        ))}
        {entries.map((entry) => (
          <EntryRow key={entry.vacationId} entry={entry} viewerId={viewerId} onOpen={onOpen} />
        ))}
      </ScrollView>
      <View className="px-5 pt-3 pb-2">
        <Pressable
          testID="day-list-book"
          onPress={() => onBook(day)}
          accessibilityRole="button"
          className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-90"
        >
          <Icon icon={PlusIcon} tone="onPrimary" size={16} weight="bold" />
          <Text className="text-[15px] font-semibold text-primary-foreground">
            {labels.book(title)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
