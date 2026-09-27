import DateTimePicker from "@react-native-community/datetimepicker";
import {
  BellSimpleIcon,
  CalendarDotsIcon,
  ClockIcon,
  SignInIcon,
  SignOutIcon,
} from "phosphor-react-native";
import { Linking, Pressable, Switch, View } from "react-native";

import { Divider, Row, Section } from "@/components/settings/grouped-list";
import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  notificationPermission,
  reminderPrefs,
  tickedWeekdays,
  toggleWeekday,
  useReminderPrefs,
  useReminderReads,
  workingWeekdays,
  type NotificationPermission,
} from "@/lib/reminders";
import { dateOfTime, timeOfDate } from "@/lib/requests/times";

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
// `t.calendar.weekdaysShort` starts on Monday.
const CHIP_ORDER = [1, 2, 3, 4, 5, 6, 0];

function PillButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-full bg-accent px-3.5 py-1.5 active:opacity-70"
    >
      <Text className="text-[13px] font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}

/** Whether iOS lets Flexi Day notify at all, with the way to change it. */
export function NotificationPermissionRow({ permission }: { permission: NotificationPermission }) {
  const { t } = useTranslation();
  const value =
    permission === "granted"
      ? t.reminders.permissionOn
      : permission === "denied"
        ? t.reminders.permissionOff
        : permission === "undetermined"
          ? t.reminders.permissionNotSet
          : null;
  const accessory =
    permission === "denied" ? (
      <PillButton
        testID="settings-notifications-open-settings"
        label={t.reminders.openSettings}
        onPress={() => void Linking.openSettings()}
      />
    ) : permission === "undetermined" ? (
      <PillButton
        testID="settings-notifications-turn-on"
        label={t.reminders.turnOn}
        onPress={() => void notificationPermission.request()}
      />
    ) : null;

  return (
    <Row
      testID="settings-notifications-permission"
      icon={BellSimpleIcon}
      label={t.reminders.permission}
      value={value}
      accessory={accessory}
    />
  );
}

function WeekdayChips({
  ticked,
  working,
  disabled,
  onToggle,
}: {
  ticked: readonly number[];
  working: readonly number[];
  disabled: boolean;
  onToggle: (weekday: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-1.5 px-4 pb-3.5">
      {CHIP_ORDER.map((weekday, index) => {
        const worked = working.includes(weekday);
        const on = worked && ticked.includes(weekday);
        const off = disabled || !worked;
        const label = t.calendar.weekdaysShort[index];
        return (
          <Pressable
            key={weekday}
            testID={`settings-reminder-day-${weekday}`}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityState={{ checked: on, disabled: off }}
            disabled={off}
            onPress={() => onToggle(weekday)}
            className={cn(
              "h-9 flex-1 items-center justify-center rounded-full",
              on ? "bg-primary" : "bg-muted"
            )}
            style={off ? { opacity: worked ? 0.45 : 0.3 } : undefined}
          >
            <Text
              className={cn(
                "text-[12.5px] font-semibold",
                on ? "text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The phone's own reminder settings, shown while attendance is active. They take effect only once
 * iOS allows notifications; while it refuses, the section stays visible and says why.
 */
export function ClockRemindersSection({ permission }: { permission: NotificationPermission }) {
  const { t } = useTranslation();
  const primary = useTone("primary");
  const prefs = useReminderPrefs();
  const { active, thisMonth, nextMonth } = useReminderReads();

  if (!active) return null;

  const denied = permission === "denied";
  const months = [thisMonth.data, nextMonth.data].filter((month) => month !== undefined);
  const working = workingWeekdays(months) ?? ALL_WEEKDAYS;
  const ticked = tickedWeekdays(prefs.clockIn.weekdays, working);

  // Switching a reminder on is the moment to ask, if the explainer was put off.
  const askIfUnasked = (on: boolean) => {
    if (on && permission === "undetermined") void notificationPermission.request();
  };

  const setClockIn = (change: Partial<(typeof prefs)["clockIn"]>) =>
    reminderPrefs.save({ ...prefs, clockIn: { ...prefs.clockIn, ...change } });

  return (
    <Section
      label={t.reminders.section}
      footer={denied ? t.reminders.deniedHint : t.reminders.hint}
      testID="settings-clock-reminders"
    >
      <View style={denied ? { opacity: 0.5 } : undefined}>
        <Row
          icon={SignInIcon}
          label={t.reminders.clockInSwitch}
          accessory={
            <Switch
              testID="settings-reminder-clock-in"
              accessibilityLabel={t.reminders.clockInSwitch}
              value={prefs.clockIn.enabled}
              disabled={denied}
              onValueChange={(enabled) => {
                setClockIn({ enabled });
                askIfUnasked(enabled);
              }}
              trackColor={{ true: primary }}
            />
          }
        />
        {prefs.clockIn.enabled ? (
          <>
            <Divider />
            <Row
              icon={ClockIcon}
              label={t.reminders.time}
              accessory={
                <DateTimePicker
                  testID="settings-reminder-time"
                  mode="time"
                  display="compact"
                  minuteInterval={5}
                  disabled={denied}
                  value={dateOfTime(prefs.clockIn.time)}
                  onValueChange={(_event, date) => setClockIn({ time: timeOfDate(date) })}
                  accentColor={primary}
                />
              }
            />
            <Divider />
            <View className="flex-row items-center gap-3 px-4 pt-3 pb-2.5">
              <Icon icon={CalendarDotsIcon} tone="muted" />
              <Text className="text-[15.5px] font-semibold text-foreground">
                {t.reminders.days}
              </Text>
            </View>
            <WeekdayChips
              ticked={ticked}
              working={working}
              disabled={denied}
              onToggle={(weekday) =>
                setClockIn({ weekdays: toggleWeekday(prefs.clockIn.weekdays, working, weekday) })
              }
            />
          </>
        ) : null}
        <Divider />
        <Row
          icon={SignOutIcon}
          label={t.reminders.clockOutSwitch}
          accessory={
            <Switch
              testID="settings-reminder-clock-out"
              accessibilityLabel={t.reminders.clockOutSwitch}
              value={prefs.clockOut.enabled}
              disabled={denied}
              onValueChange={(enabled) => {
                reminderPrefs.save({ ...prefs, clockOut: { enabled } });
                askIfUnasked(enabled);
              }}
              trackColor={{ true: primary }}
            />
          }
        />
      </View>
    </Section>
  );
}
