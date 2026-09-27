import { CaretLeftIcon, CaretRightIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { formatBusinessDay, stepDay } from "@/lib/attendance";
import { cn } from "@/lib/cn";

export type AttendanceView = "day" | "week" | "month";

const VIEWS: AttendanceView[] = ["day", "week", "month"];

/** Views not built yet show, and cannot be picked. */
export function ViewPill({
  value,
  available,
  onChange,
}: {
  value: AttendanceView;
  available: AttendanceView[];
  onChange: (view: AttendanceView) => void;
}) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-full bg-muted p-1">
      {VIEWS.map((view) => {
        const selected = view === value;
        const enabled = available.includes(view);
        return (
          <Pressable
            key={view}
            testID={`attendance-view-${view}`}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: !enabled }}
            disabled={!enabled}
            onPress={() => onChange(view)}
            className={cn(
              "h-9 flex-1 items-center justify-center rounded-full",
              selected && "bg-card",
              !enabled && "opacity-40"
            )}
          >
            <Text
              className={cn(
                "text-[13.5px] font-semibold",
                selected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {t.attendance.views[view]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DayStepper({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string | null) => void;
}) {
  const { t, locale } = useTranslation();
  const previous = stepDay(date, -1, today);
  const next = stepDay(date, 1, today);
  const steps = [
    { key: "previous", to: previous, icon: CaretLeftIcon, label: t.attendance.previousDay },
    { key: "next", to: next, icon: CaretRightIcon, label: t.attendance.nextDay },
  ];

  return (
    <View className="flex-row items-center gap-2">
      <Text
        testID="attendance-day"
        className="font-display flex-1 text-[20px] font-semibold text-foreground"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatBusinessDay(date, locale)}
      </Text>
      {date !== today ? (
        <Pressable
          testID="attendance-today"
          accessibilityRole="button"
          onPress={() => onChange(null)}
          hitSlop={4}
          className="h-9 justify-center rounded-full bg-accent px-3.5 active:opacity-70"
        >
          <Text className="text-[13.5px] font-semibold text-primary">
            {t.attendance.backToToday}
          </Text>
        </Pressable>
      ) : null}
      {steps.map((step) => (
        <Pressable
          key={step.key}
          testID={`attendance-day-${step.key}`}
          disabled={step.to === null}
          // Null follows today, so a view left on it moves on at midnight.
          onPress={() => onChange(step.to === today ? null : step.to)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={step.label}
          accessibilityState={{ disabled: step.to === null }}
          className={cn(
            "h-9 w-9 items-center justify-center rounded-full border border-input bg-card active:opacity-70",
            step.to === null && "opacity-40"
          )}
        >
          <Icon icon={step.icon} tone="muted" size={16} weight="bold" />
        </Pressable>
      ))}
    </View>
  );
}
