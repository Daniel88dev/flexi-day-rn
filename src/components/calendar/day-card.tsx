import { useState } from "react";
import { View } from "react-native";

import { GroupEventSheet } from "@/components/calendar/group-event-detail";
import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";
import type { CalendarGroupEvent } from "@/lib/local-store";

/** The stripes calendar's day list, inline under the grid where the lanes open a sheet. */
export function DayCard({ day, ...props }: StoreDayListProps & { day: string }) {
  const [detail, setDetail] = useState<CalendarGroupEvent | null>(null);
  return (
    <View testID="day-card" className="mx-4 rounded-[24px] border border-border bg-card pt-4 pb-2">
      <StoreDayList day={day} {...props} onEvent={setDetail} />
      <GroupEventSheet event={detail} viewerId={props.viewerId} onClose={() => setDetail(null)} />
    </View>
  );
}
