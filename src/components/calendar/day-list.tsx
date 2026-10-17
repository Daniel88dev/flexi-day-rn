import { CakeIcon, CaretRightIcon, PlusIcon } from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { BIRTHDAY_PINK } from "@/components/calendar/day-mark";
import { PersonAvatar } from "@/components/calendar/person-avatar";
import { SendingBadge, StatusBadge } from "@/components/requests/badges";
import { Icon } from "@/components/ui/icon";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dayParts, type DayEntry } from "@/lib/calendar/day";
import { cn } from "@/lib/cn";
import type { CalendarBirthday } from "@/lib/local-store";
import { runDatesLabel } from "@/lib/requests/format";
import { firstName } from "@/lib/viewer/viewer";

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
      disabled={entry.pending}
      accessibilityRole="button"
      accessibilityState={{ disabled: entry.pending }}
      accessibilityLabel={[name, details, t.status[entry.status]].join(", ")}
      style={entry.pending ? { opacity: 0.55 } : undefined}
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
      {entry.pending ? (
        <SendingBadge />
      ) : entry.status === "pending" ? (
        <StatusBadge status="pending" />
      ) : null}
    </Pressable>
  );
}

function BirthdayRow({
  birthday,
  onSettings,
}: {
  birthday: CalendarBirthday;
  onSettings?: () => void;
}) {
  const { t } = useTranslation();
  const labels = t.dashboard.calendar;
  const name = firstName(birthday.userName ?? undefined, "?");
  const label = birthday.own
    ? birthday.age === null
      ? labels.yourBirthday
      : labels.yourBirthdayAge(birthday.age)
    : birthday.age === null
      ? labels.namesBirthday(name)
      : labels.nameTurns(name, birthday.age);
  const opensSettings = birthday.own && onSettings !== undefined;

  return (
    <Pressable
      testID={`day-list-birthday-${birthday.userId}`}
      onPress={opensSettings ? onSettings : undefined}
      disabled={!opensSettings}
      accessibilityRole={opensSettings ? "link" : "text"}
      accessibilityLabel={label}
      className="mb-1 flex-row items-center gap-3 overflow-hidden rounded-[16px] px-3 py-2.5 active:opacity-80"
    >
      <View
        className="absolute inset-0"
        style={{ backgroundColor: BIRTHDAY_PINK, opacity: 0.12 }}
      />
      <CakeIcon size={18} color={BIRTHDAY_PINK} weight="fill" />
      <Text
        className="flex-1 text-[15px] font-semibold"
        style={{ color: BIRTHDAY_PINK }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {opensSettings ? (
        <View className="flex-row items-center gap-0.5">
          <Text className="text-[12px] text-faint">{labels.birthdaySettings}</Text>
          <Icon icon={CaretRightIcon} tone="faint" size={12} />
        </View>
      ) : null}
    </Pressable>
  );
}

const NO_BIRTHDAYS: readonly CalendarBirthday[] = [];

/** The lanes calendar shows this list in a sheet; the stripes calendar shows it inline. */
export function DayList({
  day,
  entries,
  holidays,
  birthdays = NO_BIRTHDAYS,
  viewerId,
  onOpen,
  onBook,
  onSettings,
}: {
  day: string;
  entries: readonly DayEntry[];
  holidays: readonly string[];
  birthdays?: readonly CalendarBirthday[];
  viewerId: string | null;
  onOpen?: (vacationId: string) => void;
  onBook: (day: string) => void;
  /** Opens Settings from the viewer's own birthday. */
  onSettings?: () => void;
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
        {birthdays.map((birthday) => (
          <BirthdayRow key={birthday.userId} birthday={birthday} onSettings={onSettings} />
        ))}
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
