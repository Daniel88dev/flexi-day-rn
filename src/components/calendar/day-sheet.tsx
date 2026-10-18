import { useRef } from "react";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { GroupEventDetail } from "@/components/calendar/group-event-detail";
import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";
import { useTranslation } from "@/i18n/use-translation";
import type { CalendarGroupEvent } from "@/lib/local-store";

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
  /** The group event whose detail the sheet shows instead of the day list. */
  detail: CalendarGroupEvent | null;
  onDetail: (event: CalendarGroupEvent | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const afterCloseRef = useRef<(() => void) | null>(null);

  const closeThen = (run: () => void) => {
    afterCloseRef.current = run;
    onClose();
  };

  const dismissed = () => {
    const run = afterCloseRef.current;
    afterCloseRef.current = null;
    run?.();
  };

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
      onDismiss={dismissed}
      closeLabel={t.account.cancel}
      testID="day-sheet"
    >
      {day === null ? null : detail ? (
        <GroupEventDetail
          event={detail}
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
