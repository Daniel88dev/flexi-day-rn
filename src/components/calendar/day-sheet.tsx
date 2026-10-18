import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { GroupEventDetail } from "@/components/calendar/group-event-detail";
import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";
import { useAfterDismiss } from "@/components/calendar/use-after-dismiss";
import { useShownGroupEvents } from "@/components/calendar/use-shown-group-events";
import { useTranslation } from "@/i18n/use-translation";
import type { CalendarGroupEvent } from "@/lib/local-store";
import { monthOf } from "@/lib/requests/months";

const NONE: readonly CalendarGroupEvent[] = [];

/**
 * The lanes' day list in a sheet. A group event's detail takes the sheet's place rather than
 * opening a second modal, which iOS would not present over this one; for the same reason the
 * editor opens only once the sheet has finished hiding.
 */
export function DaySheet({
  day,
  detail,
  onDetail,
  onClose,
  onNewEvent,
  onEditEvent,
  onDeleteEvent,
  ...props
}: StoreDayListProps & {
  day: string | null;
  detail: CalendarGroupEvent | null;
  onDetail: (event: CalendarGroupEvent | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { closeThen, onDismiss } = useAfterDismiss(onClose);
  const [shown] = useShownGroupEvents(
    detail ? [detail] : NONE,
    detail && day ? monthOf(day) : null,
    props.scope
  );

  const newEvent = onNewEvent && ((date: string) => closeThen(() => onNewEvent(date)));
  const edit = onEditEvent && ((event: CalendarGroupEvent) => closeThen(() => onEditEvent(event)));
  const remove =
    onDeleteEvent &&
    ((event: CalendarGroupEvent) => {
      onDetail(null);
      onDeleteEvent(event);
    });

  return (
    <BottomSheet
      open={day !== null}
      onClose={onClose}
      onDismiss={onDismiss}
      closeLabel={t.account.cancel}
      testID="day-sheet"
    >
      {day === null ? null : shown ? (
        <GroupEventDetail
          event={shown}
          viewerId={props.viewerId}
          onBack={() => onDetail(null)}
          onEdit={edit}
          onDelete={remove}
        />
      ) : (
        <StoreDayList
          day={day}
          {...props}
          onEvent={onDetail}
          onNewEvent={newEvent}
          onEditEvent={edit}
          onDeleteEvent={remove}
        />
      )}
    </BottomSheet>
  );
}
