import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";
import { useTranslation } from "@/i18n/use-translation";

export function DaySheet({
  day,
  onClose,
  ...props
}: StoreDayListProps & { day: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={day !== null}
      onClose={onClose}
      closeLabel={t.account.cancel}
      testID="day-sheet"
    >
      {day ? <StoreDayList day={day} {...props} /> : null}
    </BottomSheet>
  );
}
