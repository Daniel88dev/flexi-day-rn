import { CaretLeftIcon, CaretRightIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { YearMonth } from "@/lib/requests/months";

export function CalendarHeader({
  month,
  canPrevious,
  canNext,
  onStep,
  onToday,
}: {
  month: YearMonth;
  canPrevious: boolean;
  canNext: boolean;
  onStep: (delta: -1 | 1) => void;
  onToday: () => void;
}) {
  const { t } = useTranslation();
  const steps = [
    { delta: -1, enabled: canPrevious, icon: CaretLeftIcon, label: t.requests.previousMonth },
    { delta: 1, enabled: canNext, icon: CaretRightIcon, label: t.requests.nextMonth },
  ] as const;

  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        testID="calendar-title"
        onPress={onToday}
        accessibilityRole="button"
        accessibilityHint={t.dashboard.calendar.today}
        className="active:opacity-70"
      >
        <Text className="font-display text-[22px] font-semibold text-foreground">
          {t.calendar.months[month.month - 1]} {month.year}
        </Text>
      </Pressable>
      <View className="flex-row gap-1.5">
        {steps.map((step) => (
          <Pressable
            key={step.delta}
            testID={step.delta < 0 ? "calendar-previous" : "calendar-next"}
            disabled={!step.enabled}
            onPress={() => onStep(step.delta)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={step.label}
            accessibilityState={{ disabled: !step.enabled }}
            className={cn(
              "h-9 w-9 items-center justify-center rounded-full border border-input bg-card active:opacity-70",
              !step.enabled && "opacity-40"
            )}
          >
            <Icon icon={step.icon} tone="muted" size={16} weight="bold" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
