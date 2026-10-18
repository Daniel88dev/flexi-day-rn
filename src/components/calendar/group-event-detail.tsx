import {
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  ClockIcon,
  LockIcon,
  NoteIcon,
  UsersIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dayParts } from "@/lib/calendar/day";
import { addedByLabel, lockLabel, ruleSummary, timeLabel } from "@/lib/group-events/labels";
import type { CalendarGroupEvent } from "@/lib/local-store";

function DetailLine({ icon, text }: { icon: PhosphorIcon; text: string }) {
  return (
    <View className="flex-row items-start gap-3 px-1 py-1.5">
      <Icon icon={icon} tone="muted" size={18} />
      <Text className="flex-1 text-[15px] text-foreground">{text}</Text>
    </View>
  );
}

/**
 * One group event in full: date, time, rule, note, group and creator, and the lock line for a
 * viewer who cannot change it. The day sheet shows it in place of the day list, with Back.
 */
export function GroupEventDetail({
  event,
  viewerId,
  onBack,
}: {
  event: CalendarGroupEvent;
  viewerId: string | null;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const dayTitle = (date: string) => {
    const { weekday, date: dayMonth } = dayParts(date);
    return t.calendar.dayTitle(weekday, dayMonth);
  };
  const singleDay = event.startDate === event.endDate;
  const dates = singleDay
    ? dayTitle(event.startDate)
    : `${dayTitle(event.startDate)} – ${dayTitle(event.endDate)}`;
  const time =
    event.startTime === null || event.endTime === null
      ? t.groupEvents.allDay
      : singleDay
        ? timeLabel(event, t)
        : `${event.startTime} – ${event.endTime}`;
  const rule = event.repeat ? ruleSummary(event.ruleStartDate, event.repeat, t) : null;

  return (
    <View testID="group-event-detail" className="shrink px-4">
      {onBack ? (
        <Pressable
          testID="group-event-detail-back"
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t.groupEvents.back}
          hitSlop={8}
          className="flex-row items-center gap-1 self-start px-1 pb-1"
        >
          <Icon icon={CaretLeftIcon} tone="primary" size={14} weight="bold" />
          <Text className="text-[14px] font-semibold text-primary">{t.groupEvents.back}</Text>
        </Pressable>
      ) : null}
      <Text className="font-display px-1 pb-2 text-[20px] font-semibold text-foreground">
        {event.title}
      </Text>
      <ScrollView className="shrink">
        <DetailLine icon={CalendarBlankIcon} text={dates} />
        <DetailLine icon={ClockIcon} text={time} />
        {rule ? <DetailLine icon={ArrowsClockwiseIcon} text={rule} /> : null}
        {event.changedOnce ? (
          <DetailLine icon={ArrowsClockwiseIcon} text={t.groupEvents.changedOnce} />
        ) : null}
        {event.note ? <DetailLine icon={NoteIcon} text={event.note} /> : null}
        <DetailLine
          icon={UsersIcon}
          text={`${event.groupName} · ${addedByLabel(event.creator, viewerId, t)}`}
        />
        {event.canEdit ? null : (
          <View className="flex-row items-center gap-1.5 px-1 pt-3 pb-2">
            <Icon icon={LockIcon} tone="faint" size={14} />
            <Text className="flex-1 text-[13px] text-faint">{lockLabel(event.creator, t)}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** The detail on its own sheet, for the stripes' inline day card. */
export function GroupEventSheet({
  event,
  viewerId,
  onClose,
}: {
  event: CalendarGroupEvent | null;
  viewerId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={event !== null}
      onClose={onClose}
      closeLabel={t.groupEvents.close}
      testID="group-event-sheet"
    >
      {event ? (
        <View className="pb-3">
          <GroupEventDetail event={event} viewerId={viewerId} />
        </View>
      ) : null}
    </BottomSheet>
  );
}
