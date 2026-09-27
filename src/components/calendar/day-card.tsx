import { View } from "react-native";

import { StoreDayList, type StoreDayListProps } from "@/components/calendar/store-day-list";

/** The stripes calendar's day list, inline under the grid where the lanes open a sheet. */
export function DayCard({ day, ...props }: StoreDayListProps & { day: string }) {
  return (
    <View testID="day-card" className="mx-4 rounded-[24px] border border-border bg-card pt-4 pb-2">
      <StoreDayList day={day} {...props} />
    </View>
  );
}
