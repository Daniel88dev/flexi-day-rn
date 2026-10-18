import { View } from "react-native";

import { GroupEventSheet } from "@/components/calendar/group-event-detail";
import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";
import { useAfterDismiss } from "@/components/calendar/use-after-dismiss";
import { useShownGroupEvents } from "@/components/calendar/use-shown-group-events";
import type { CalendarGroupEvent } from "@/lib/local-store";
import { monthOf } from "@/lib/requests/months";

const NONE: readonly CalendarGroupEvent[] = [];

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
  const { onEditEvent, onDeleteEvent } = props;
  const { closeThen, onDismiss } = useAfterDismiss(() => onDetail(null));
  const [shown] = useShownGroupEvents(
    detail ? [detail] : NONE,
    detail ? monthOf(day) : null,
    props.scope
  );

  return (
    <View testID="day-card" className="mx-4 rounded-[24px] border border-border bg-card pt-4 pb-2">
      <StoreDayList day={day} {...props} onEvent={onDetail} />
      <GroupEventSheet
        event={shown ?? null}
        viewerId={props.viewerId}
        onClose={() => onDetail(null)}
        onDismiss={onDismiss}
        onEdit={onEditEvent && ((event) => closeThen(() => onEditEvent(event)))}
        onDelete={onDeleteEvent && ((event) => closeThen(() => onDeleteEvent(event)))}
      />
    </View>
  );
}
