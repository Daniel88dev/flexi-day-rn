import { Pressable, View } from "react-native";

import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";

/** Picks the one allowance the report shows. A choice of one is no choice, so it hides. */
export function LeaveTypeTabs({
  types,
  value,
  onChange,
}: {
  types: CalendarRecordType[];
  value: CalendarRecordType;
  onChange: (type: CalendarRecordType) => void;
}) {
  const { t } = useTranslation();
  if (types.length < 2) return null;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t.report.leaveTypes}
      className="flex-row rounded-full bg-muted p-1"
    >
      {types.map((type) => {
        const selected = type === value;
        return (
          <Pressable
            key={type}
            testID={`report-type-${type}`}
            onPress={() => onChange(type)}
            accessibilityRole="tab"
            accessibilityLabel={t.recordTypes[type]}
            accessibilityState={{ selected }}
            className={cn(
              "h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2",
              selected && "bg-card shadow-sm elevation-sm"
            )}
          >
            <View className={cn("h-2 w-2 rounded-full", LEAVE_CLASSES[type].fill)} />
            <Text
              numberOfLines={1}
              className={cn(
                "text-[13.5px]",
                selected ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {t.recordTypes[type]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
