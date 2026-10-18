import DateTimePicker from "@react-native-community/datetimepicker";
import { ArrowsClockwiseIcon, CheckIcon, MinusIcon, PlusIcon } from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { dateOfDay, dayOfDate } from "@/lib/days";
import { defaultRule, fitRule, nextDates } from "@/lib/group-events/draft";
import { ruleSummary } from "@/lib/group-events/labels";
import {
  monthPosition,
  plusDays,
  weekdayOf,
  type IsoDate,
  type RepeatRule,
} from "@/lib/group-events/occurrences";

const FREQS = ["never", "daily", "weekly", "monthly", "yearly"] as const;
const UNTIL_DEFAULT_DAYS = 91;

function Hair() {
  return <View className="ml-4 h-px bg-border" />;
}

function Chip({
  testID,
  label,
  on,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on, disabled: Boolean(disabled) }}
      style={{ opacity: disabled ? 0.45 : 1 }}
      className={cn(
        "rounded-full border px-3 py-1.5",
        on ? "border-foreground bg-foreground" : "border-input"
      )}
    >
      <Text className={cn("text-[13px] font-semibold", on ? "text-background" : "text-foreground")}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepButton({
  testID,
  label,
  icon,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  icon: typeof PlusIcon;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ opacity: disabled ? 0.35 : 1 }}
      className="h-8 w-10 items-center justify-center rounded-[10px] bg-muted"
    >
      <Icon icon={icon} tone="foreground" size={15} weight="bold" />
    </Pressable>
  );
}

function Choice({
  testID,
  label,
  on,
  onPress,
}: {
  testID: string;
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      className="min-h-[46px] flex-row items-center px-4 active:opacity-70"
    >
      <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
      {on ? <Icon icon={CheckIcon} tone="primary" size={16} weight="bold" /> : null}
    </Pressable>
  );
}

/**
 * `value` holds what the person picked; what shows is that rule fitted to the start, so the
 * start's weekday is always on. A run of days cannot repeat.
 */
export function RepeatControls({
  start,
  value,
  multiDay,
  onChange,
}: {
  start: IsoDate;
  value: RepeatRule | null;
  multiDay: boolean;
  onChange: (rule: RepeatRule | null) => void;
}) {
  const { t } = useTranslation();
  const labels = t.groupEvents.editor;
  const primary = useTone("primary");
  const rule = value ? fitRule(value, start) : null;
  const set = (patch: Partial<RepeatRule>) => value && onChange({ ...value, ...patch });
  const startWeekday = weekdayOf(start);
  const startDay = Number(start.slice(8, 10));
  const { nth, isLast } = monthPosition(start);
  const weekdayName = t.groupEvents.weekdaysLong[startWeekday];
  const preview = rule ? nextDates(start, rule) : [];

  return (
    <View className="gap-1.5">
      <View className="overflow-hidden rounded-[24px] bg-card">
        <View className="gap-2 px-4 py-3">
          <View className="flex-row items-center gap-3">
            <Icon icon={ArrowsClockwiseIcon} tone="muted" />
            <Text className="flex-1 text-[15.5px] font-semibold text-foreground">
              {labels.repeat}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-1.5"
          >
            {FREQS.map((freq) => (
              <Chip
                key={freq}
                testID={`group-event-editor-repeat-${freq}`}
                label={labels.freq[freq]}
                on={(rule?.freq ?? "never") === freq}
                disabled={multiDay}
                onPress={() => onChange(freq === "never" ? null : defaultRule(freq, start))}
              />
            ))}
          </ScrollView>
        </View>

        {rule ? (
          <>
            <Hair />
            <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-2">
              <Text
                testID="group-event-editor-interval"
                className="flex-1 text-[15.5px] font-semibold text-foreground"
              >
                {labels.every(rule.freq, rule.interval)}
              </Text>
              <StepButton
                testID="group-event-editor-interval-down"
                label={labels.fewer}
                icon={MinusIcon}
                disabled={rule.interval <= 1}
                onPress={() => set({ interval: rule.interval - 1 })}
              />
              <StepButton
                testID="group-event-editor-interval-up"
                label={labels.more}
                icon={PlusIcon}
                disabled={rule.interval >= 99}
                onPress={() => set({ interval: rule.interval + 1 })}
              />
            </View>
          </>
        ) : null}

        {rule?.freq === "weekly" ? (
          <>
            <Hair />
            <View className="flex-row justify-between px-4 py-3">
              {t.calendar.weekdaysShort.map((name, day) => {
                const on = rule.weekdays.includes(day);
                const locked = day === startWeekday;
                return (
                  <Pressable
                    key={name}
                    testID={`group-event-editor-weekday-${day}`}
                    disabled={locked}
                    onPress={() =>
                      set({
                        weekdays: on
                          ? rule.weekdays.filter((d) => d !== day)
                          : [...rule.weekdays, day].sort((a, b) => a - b),
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t.groupEvents.weekdaysLong[day]}
                    accessibilityHint={locked ? labels.startWeekday : undefined}
                    accessibilityState={{ selected: on, disabled: locked }}
                    className={cn(
                      "h-9 w-9 items-center justify-center rounded-full",
                      on ? "bg-foreground" : "bg-muted"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-[12px] font-bold",
                        on ? "text-background" : "text-muted-foreground"
                      )}
                    >
                      {name.slice(0, 2)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {rule?.freq === "monthly" ? (
          <>
            <Hair />
            <Choice
              testID="group-event-editor-monthly-day"
              label={labels.onDay(startDay)}
              on={rule.monthlyMode === "day"}
              onPress={() => set({ monthlyMode: "day" })}
            />
            {nth <= 4 ? (
              <>
                <Hair />
                <Choice
                  testID="group-event-editor-monthly-weekday"
                  label={labels.onNthWeekday(nth, weekdayName)}
                  on={rule.monthlyMode === "weekday"}
                  onPress={() => set({ monthlyMode: "weekday" })}
                />
              </>
            ) : null}
            {isLast ? (
              <>
                <Hair />
                <Choice
                  testID="group-event-editor-monthly-last"
                  label={labels.onLastWeekday(weekdayName)}
                  on={rule.monthlyMode === "lastWeekday"}
                  onPress={() => set({ monthlyMode: "lastWeekday" })}
                />
              </>
            ) : null}
          </>
        ) : null}

        {rule ? (
          <>
            <Hair />
            <View className="min-h-[52px] flex-row flex-wrap items-center gap-2 px-4 py-2">
              <Text className="flex-1 text-[15.5px] font-semibold text-foreground">
                {labels.ends}
              </Text>
              <Chip
                testID="group-event-editor-ends-never"
                label={labels.endsNever}
                on={rule.until === null}
                onPress={() => set({ until: null })}
              />
              <Chip
                testID="group-event-editor-ends-on"
                label={labels.endsOnDate}
                on={rule.until !== null}
                onPress={() =>
                  rule.until === null && set({ until: plusDays(start, UNTIL_DEFAULT_DAYS) })
                }
              />
              {rule.until !== null ? (
                <DateTimePicker
                  testID="group-event-editor-until"
                  mode="date"
                  display="compact"
                  value={dateOfDay(rule.until)}
                  minimumDate={dateOfDay(start)}
                  accentColor={primary}
                  onValueChange={(_event, date) => set({ until: dayOfDate(date) })}
                />
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      {multiDay ? <Text className="px-4 text-[12px] text-faint">{labels.lastsOneDay}</Text> : null}
      {rule?.freq === "monthly" && startDay > 28 && rule.monthlyMode === "day" ? (
        <Text className="px-4 text-[12px] text-faint">{labels.shorterMonths}</Text>
      ) : null}

      {rule ? (
        <View testID="group-event-editor-next-dates" className="gap-1 px-4 pt-1">
          <Text className="text-[12.5px] font-semibold text-muted-foreground">
            {ruleSummary(start, rule, t)}
          </Text>
          <Text className="text-[11px] font-bold tracking-[1px] text-faint uppercase">
            {labels.nextDates}
          </Text>
          <Text className="text-[13px] leading-[19px] text-muted-foreground">
            {preview.map((date) => t.groupEvents.dayMonth(dayMonthOf(date))).join(" · ")}
            {preview.length === 6 ? " · …" : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const dayMonthOf = (date: IsoDate) => ({
  day: Number(date.slice(8, 10)),
  month: Number(date.slice(5, 7)),
});
