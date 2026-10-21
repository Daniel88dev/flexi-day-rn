import { CaretLeftIcon, CaretRightIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  MONTH_WINDOW_LENGTHS,
  monthWindowLabel,
  resizeMonthWindow,
  sameMonthWindow,
  shiftMonthWindow,
  type MonthBounds,
  type MonthWindow,
} from "@/lib/requests/months";

export function MonthWindowControl({
  value,
  bounds,
  defaultWindow,
  onChange,
}: {
  value: MonthWindow;
  bounds: MonthBounds;
  defaultWindow: MonthWindow;
  onChange: (window: MonthWindow) => void;
}) {
  const { t } = useTranslation();
  const steps = [
    { delta: -1, icon: CaretLeftIcon, label: t.requests.previousMonth, direction: "previous" },
    { delta: 1, icon: CaretRightIcon, label: t.requests.nextMonth, direction: "next" },
  ].map((step) => ({ ...step, to: shiftMonthWindow(value, step.delta, bounds) }));

  return (
    <View className="gap-3">
      <View className="flex-row rounded-full bg-muted p-1">
        {MONTH_WINDOW_LENGTHS.map((length) => {
          const selected = length === value.length;
          return (
            <Pressable
              key={length}
              testID={`requests-window-${length}`}
              onPress={() => onChange(resizeMonthWindow(value, length, bounds))}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={cn(
                "flex-1 items-center rounded-full py-1.5 active:opacity-80",
                selected && "bg-background shadow-sm"
              )}
            >
              <Text
                className={cn(
                  "text-[14px]",
                  selected ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {t.requests.windowLength(length)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row items-center justify-between">
        <Text
          testID="requests-month"
          className="font-display text-[20px] font-semibold text-foreground"
        >
          {monthWindowLabel(value, t.calendar.monthsShort)}
        </Text>
        <View className="flex-row gap-1.5">
          {steps.map((step) => (
            <Pressable
              key={step.delta}
              testID={`requests-month-${step.direction}`}
              disabled={step.to === null}
              onPress={() => step.to && onChange(step.to)}
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
      </View>
      {sameMonthWindow(value, defaultWindow) ? null : (
        <Pressable
          testID="requests-window-reset"
          onPress={() => onChange(defaultWindow)}
          accessibilityRole="button"
          hitSlop={8}
          className="self-start active:opacity-70"
        >
          <Text className="text-[13px] font-medium text-primary">{t.requests.backToThisMonth}</Text>
        </Pressable>
      )}
    </View>
  );
}
