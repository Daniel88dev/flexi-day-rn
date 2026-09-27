import { View } from "react-native";

import { LEAVE_CLASSES, LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRange } from "@/lib/calendar/lanes";

export function Legend({ ranges }: { ranges: readonly CalendarRange[] }) {
  const { t } = useTranslation();
  const types = LEAVE_TYPE_ORDER.filter((type) => ranges.some((range) => range.type === type));
  if (types.length === 0) return null;

  return (
    <View testID="calendar-legend" className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1.5 px-1">
      {types.map((type) => (
        <View key={type} className="flex-row items-center gap-1.5">
          <View className={cn("h-[9px] w-[9px] rounded-full", LEAVE_CLASSES[type].fill)} />
          <Text className="text-[12.5px] font-medium text-muted-foreground">
            {t.recordTypes[type]}
          </Text>
        </View>
      ))}
      <View testID="calendar-legend-pending" className="flex-row items-center gap-1.5">
        <View
          className="h-[9px] w-[14px] rounded-[3px] border border-input"
          style={{ borderStyle: "dashed" }}
        />
        <Text className="text-[12.5px] font-medium text-muted-foreground">{t.status.pending}</Text>
      </View>
    </View>
  );
}
