import { CakeIcon, CalendarPlusIcon, CaretRightIcon, PlusIcon } from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { BIRTHDAY_PINK } from "@/components/calendar/day-mark";
import { GroupEventCard } from "@/components/calendar/group-event-card";
import { PersonAvatar } from "@/components/calendar/person-avatar";
import { SendingBadge, StatusBadge } from "@/components/requests/badges";
import { Icon } from "@/components/ui/icon";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { birthdayLabel } from "@/lib/calendar/birthday-label";
import { dayParts, type DayEntry } from "@/lib/calendar/day";
import { cn } from "@/lib/cn";
import type { CalendarBirthday, CalendarGroupEvent } from "@/lib/local-store";
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
  const label = birthdayLabel(birthday, t);
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
const NO_EVENTS: readonly CalendarGroupEvent[] = [];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-2 pt-1 pb-1.5 text-[11px] font-bold tracking-[1px] text-faint uppercase">
      {children}
    </Text>
  );
}

/** The lanes calendar shows this list in a sheet; the stripes calendar shows it inline. */
export function DayList({
  day,
  entries,
  holidays,
  birthdays = NO_BIRTHDAYS,
  events = NO_EVENTS,
  viewerId,
  onOpen,
  onBook,
  onSettings,
  onEvent,
  onNewEvent,
  onEditEvent,
  onDeleteEvent,
}: {
  day: string;
  entries: readonly DayEntry[];
  holidays: readonly string[];
  birthdays?: readonly CalendarBirthday[];
  /** The group event occurrences covering the day. */
  events?: readonly CalendarGroupEvent[];
  viewerId: string | null;
  onOpen?: (vacationId: string) => void;
  onBook: (day: string) => void;
  onSettings?: () => void;
  onEvent?: (event: CalendarGroupEvent) => void;
  /** Shown only while the day's group, or any group in Mine, may take a new group event. */
  onNewEvent?: (day: string) => void;
  onEditEvent?: (event: CalendarGroupEvent) => void;
  onDeleteEvent?: (event: CalendarGroupEvent) => void;
}) {
  const { t } = useTranslation();
  const labels = t.dashboard.calendar;
  const { weekday, date } = dayParts(day);
  const title = t.calendar.dayTitle(weekday, date);
  const upper = events.length > 0 || birthdays.length > 0;
  const away = entries.length > 0 || holidays.length > 0;

  return (
    <View testID="day-list" className="shrink">
      <View className="px-5 pt-1 pb-2">
        <Text className="font-display text-[18px] font-semibold text-foreground">{title}</Text>
        <Text className="text-[13px] text-faint">
          {entries.length === 0 ? labels.nobodyAway : labels.awayCount(entries.length)}
        </Text>
      </View>
      <ScrollView className="shrink px-3">
        {events.length > 0 ? <SectionLabel>{t.groupEvents.section}</SectionLabel> : null}
        {events.map((event) => (
          <GroupEventCard
            key={`${event.id}-${event.startDate}`}
            event={event}
            viewerId={viewerId}
            onPress={onEvent}
            onEdit={onEditEvent}
            onDelete={onDeleteEvent}
          />
        ))}
        {birthdays.map((birthday) => (
          <BirthdayRow key={birthday.userId} birthday={birthday} onSettings={onSettings} />
        ))}
        {upper && away ? <SectionLabel>{t.groupEvents.away}</SectionLabel> : null}
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
        {onNewEvent ? (
          <Pressable
            testID="day-list-new-event"
            onPress={() => onNewEvent(day)}
            accessibilityRole="button"
            accessibilityLabel={t.groupEvents.newGroupEvent}
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full border border-input active:opacity-70"
          >
            <Icon icon={CalendarPlusIcon} tone="foreground" size={16} />
            <Text className="text-[15px] font-semibold text-foreground">
              {t.groupEvents.newGroupEvent}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
