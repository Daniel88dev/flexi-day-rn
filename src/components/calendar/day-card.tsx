import { useRef } from "react";
import { View } from "react-native";

import { GroupEventSheet } from "@/components/calendar/group-event-detail";
import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";
import type { CalendarGroupEvent } from "@/lib/local-store";

/**
 * The stripes calendar's day list, inline under the grid where the lanes open a sheet. A group
 * event's detail opens on a sheet of its own, and what it opens next waits for it to hide.
 */
export function DayCard({
  day,
  detail,
  onDetail,
  ...props
}: StoreDayListProps & {
  day: string;
  detail: CalendarGroupEvent | null;
  onDetail: (event: CalendarGroupEvent | null) => void;
}) {
  const afterCloseRef = useRef<(() => void) | null>(null);
  const { onEditEvent, onDeleteEvent } = props;

  const closeThen = (run: () => void) => {
    afterCloseRef.current = run;
    onDetail(null);
  };

  const dismissed = () => {
    const run = afterCloseRef.current;
    afterCloseRef.current = null;
    run?.();
  };

  return (
    <View testID="day-card" className="mx-4 rounded-[24px] border border-border bg-card pt-4 pb-2">
      <StoreDayList day={day} {...props} onEvent={onDetail} />
      <GroupEventSheet
        event={detail}
        viewerId={props.viewerId}
        onClose={() => onDetail(null)}
        onDismiss={dismissed}
        onEdit={onEditEvent && ((event) => closeThen(() => onEditEvent(event)))}
        onDelete={onDeleteEvent && ((event) => closeThen(() => onDeleteEvent(event)))}
      />
    </View>
  );
}
