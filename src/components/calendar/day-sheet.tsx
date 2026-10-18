import { useState } from "react";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { GroupEventDetail } from "@/components/calendar/group-event-detail";
import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";
import { useTranslation } from "@/i18n/use-translation";
import type { CalendarGroupEvent } from "@/lib/local-store";

/**
 * The lanes' day list in a sheet. A group event's detail takes the sheet's place rather than
 * opening a second modal, which iOS would not present over this one.
 */
export function DaySheet({
  day,
  onClose,
  ...props
}: StoreDayListProps & { day: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState<{ day: string; event: CalendarGroupEvent } | null>(null);
  const detail = opened !== null && opened.day === day ? opened.event : null;

  const close = () => {
    setOpened(null);
    onClose();
  };

  return (
    <BottomSheet
      open={day !== null}
      onClose={close}
      closeLabel={t.account.cancel}
      testID="day-sheet"
    >
      {day === null ? null : detail ? (
        <GroupEventDetail event={detail} viewerId={props.viewerId} onBack={() => setOpened(null)} />
      ) : (
        <StoreDayList day={day} {...props} onEvent={(event) => setOpened({ day, event })} />
      )}
    </BottomSheet>
  );
}
