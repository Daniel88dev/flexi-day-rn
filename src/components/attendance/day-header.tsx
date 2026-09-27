import { CaretLeftIcon, CaretRightIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  formatBusinessDay,
  formatRangeLabel,
  holdsToday,
  stepDay,
  stepRange,
  type AttendanceView,
} from "@/lib/attendance";
import { cn } from "@/lib/cn";

const VIEWS: AttendanceView[] = ["day", "week", "month"];

export function ViewPill({
  value,
  onChange,
}: {
  value: AttendanceView;
  onChange: (view: AttendanceView) => void;
}) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-full bg-muted p-1">
      {VIEWS.map((view) => {
        const selected = view === value;
        return (
          <Pressable
            key={view}
            testID={`attendance-view-${view}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(view)}
            className={cn(
              "h-9 flex-1 items-center justify-center rounded-full",
              selected && "bg-card"
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

function Stepper({
  label,
  testID,
  previous,
  next,
  offToday,
  labels,
  today,
  onChange,
}: {
  label: string;
  testID: string;
  previous: string | null;
  next: string | null;
  offToday: boolean;
  labels: { previous: string; next: string };
  today: string;
  onChange: (anchor: string | null) => void;
}) {
  const { t } = useTranslation();
  const steps = [
    { key: "previous", to: previous, icon: CaretLeftIcon, label: labels.previous },
    { key: "next", to: next, icon: CaretRightIcon, label: labels.next },
  ];

  return (
    <View className="flex-row items-center gap-2">
      <Text
        testID={testID}
        className="font-display flex-1 text-[20px] font-semibold text-foreground"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
      {offToday ? (
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
          testID={`${testID}-${step.key}`}
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
  return (
    <Stepper
      label={formatBusinessDay(date, locale)}
      testID="attendance-day"
      previous={stepDay(date, -1, today)}
      next={stepDay(date, 1, today)}
      offToday={date !== today}
      labels={{ previous: t.attendance.previousDay, next: t.attendance.nextDay }}
      today={today}
      onChange={onChange}
    />
  );
}

/** The Week or Month stepper. It never steps past the range holding today. */
export function RangeStepper({
  view,
  anchor,
  today,
  onChange,
}: {
  view: "week" | "month";
  anchor: string;
  today: string;
  onChange: (anchor: string | null) => void;
}) {
  const { t, locale } = useTranslation();
  const labels =
    view === "week"
      ? { previous: t.attendance.previousWeek, next: t.attendance.nextWeek }
      : { previous: t.attendance.previousMonth, next: t.attendance.nextMonth };
  return (
    <Stepper
      label={formatRangeLabel(view, anchor, locale)}
      testID="attendance-range"
      previous={stepRange(view, anchor, -1, today)}
      next={stepRange(view, anchor, 1, today)}
      offToday={!holdsToday(view, anchor, today)}
      labels={labels}
      today={today}
      onChange={onChange}
    />
  );
}
