import DateTimePicker from "@react-native-community/datetimepicker";
import { WarningCircleIcon, WifiSlashIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { ClockNotice } from "@/components/clock/clock-notice";
import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { refusalMessage, type EntryFailure } from "@/lib/attendance";
import { cn } from "@/lib/cn";
import { dateOfTime, timeOfDate } from "@/lib/requests/times";

/** The self-service sheets' header: Cancel, the title, and Save, which turns into Retry. */
export function SheetHeader({
  title,
  onCancel,
  onSave,
  button,
  saving,
  testPrefix,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  button: { enabled: boolean; retry: boolean };
  saving: boolean;
  testPrefix: string;
}) {
  const { t } = useTranslation();
  const primary = useTone("primary");
  return (
    <View className="h-14 flex-row items-center justify-between border-b border-border px-2">
      <Pressable
        testID={`${testPrefix}-cancel`}
        onPress={onCancel}
        hitSlop={8}
        accessibilityRole="button"
        className="h-10 justify-center rounded-full px-3 active:opacity-70"
      >
        <Text className="text-[16px] text-primary">{t.entry.cancel}</Text>
      </Pressable>
      <Text className="font-display text-[17px] font-semibold text-foreground">{title}</Text>
      <Pressable
        testID={`${testPrefix}-save`}
        onPress={onSave}
        disabled={!button.enabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ disabled: !button.enabled, busy: saving }}
        className="h-10 min-w-[64px] items-center justify-center rounded-full px-3 active:opacity-70"
      >
        {saving ? (
          <ActivityIndicator color={primary} />
        ) : (
          <Text
            className={cn(
              "text-[16px] font-semibold",
              button.enabled ? "text-primary" : "text-faint"
            )}
          >
            {button.retry ? t.entry.retry : t.entry.save}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/** A failed write, inline where the reader is looking: no answer, a server fault, or a refusal. */
export function FailureNotice({
  failure,
  testPrefix,
  fallback,
}: {
  failure: EntryFailure;
  testPrefix: string;
  fallback?: string;
}) {
  const { t } = useTranslation();
  if (failure.kind === "network") {
    return (
      <ClockNotice
        testID={`${testPrefix}-unreachable`}
        tone="muted"
        icon={WifiSlashIcon}
        title={t.entry.unreachable}
        body={t.entry.unreachableBody}
      />
    );
  }
  if (failure.kind === "server") {
    return (
      <ClockNotice
        testID={`${testPrefix}-server-error`}
        tone="danger"
        icon={WarningCircleIcon}
        title={t.entry.serverError}
        body={t.entry.serverErrorBody}
      />
    );
  }
  return (
    <ClockNotice
      testID={`${testPrefix}-refused`}
      tone="danger"
      icon={WarningCircleIcon}
      title={refusalMessage(failure, t, fallback)}
    />
  );
}

export function SheetRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-1.5">
      <Text className="text-[15.5px] text-foreground">{label}</Text>
      {children}
    </View>
  );
}

export function Separator() {
  return <View className="ml-4 h-px bg-border" />;
}

/** "Set start" until first tapped, then iOS's compact picker from where `opensAt` says. */
export function TimeCell({
  value,
  placeholder,
  onChange,
  opensAt,
  testID,
  disabled = false,
}: {
  value: string;
  placeholder: string;
  onChange: (time: string) => void;
  opensAt: () => string;
  testID: string;
  disabled?: boolean;
}) {
  const primary = useTone("primary");
  if (value === "") {
    return (
      <Pressable
        testID={`${testID}-set`}
        onPress={() => onChange(opensAt())}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={cn(
          "h-9 justify-center rounded-full bg-accent px-3.5 active:opacity-70",
          disabled && "opacity-50"
        )}
      >
        <Text className="text-[15px] font-semibold text-primary">{placeholder}</Text>
      </Pressable>
    );
  }
  return (
    <DateTimePicker
      testID={testID}
      mode="time"
      display="compact"
      value={dateOfTime(value)}
      disabled={disabled}
      onValueChange={(_event, date) => onChange(timeOfDate(date))}
      accentColor={primary}
    />
  );
}
