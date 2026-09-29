import DateTimePicker from "@react-native-community/datetimepicker";
import { View } from "react-native";

import { FieldLabel } from "@/components/requests/fields/field-label";
import { useTone } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dateOfTime, timeOfDate } from "@/lib/requests/times";

export type Times = { startTime: string; endTime: string };

const DEFAULT_TIMES: Times = { startTime: "09:00", endTime: "17:00" };

export function TimesField({
  startTime,
  endTime,
  onChange,
}: Times & { onChange: (times: Times) => void }) {
  const { t } = useTranslation();
  const primary = useTone("primary");
  const times: Times = { startTime, endTime };
  const on = Boolean(startTime || endTime);

  const picker = (which: keyof Times, label: string, testID: string) => (
    <View className="min-h-[52px] flex-row items-center justify-between px-4 py-1.5">
      <Text className="text-[15.5px] text-foreground">{label}</Text>
      <DateTimePicker
        testID={testID}
        mode="time"
        display="compact"
        minuteInterval={5}
        value={dateOfTime(times[which] || DEFAULT_TIMES[which])}
        onValueChange={(_event, date) => onChange({ ...times, [which]: timeOfDate(date) })}
        accentColor={primary}
      />
    </View>
  );

  return (
    <View>
      <FieldLabel>{t.requestForm.times}</FieldLabel>
      <View className="overflow-hidden rounded-[24px] bg-card">
        <View className="min-h-[52px] flex-row items-center justify-between px-4">
          <Text className="text-[15.5px] text-foreground">{t.requestForm.specificTimes}</Text>
          <Switch
            testID="times-field-switch"
            accessibilityLabel={t.requestForm.specificTimes}
            value={on}
            onValueChange={(next) =>
              onChange(next ? DEFAULT_TIMES : { startTime: "", endTime: "" })
            }
            trackColor={{ true: primary }}
          />
        </View>
        {on ? (
          <>
            <View className="ml-4 h-px bg-border" />
            {picker("startTime", t.requestForm.startTime, "times-field-start")}
            <View className="ml-4 h-px bg-border" />
            {picker("endTime", t.requestForm.endTime, "times-field-end")}
          </>
        ) : null}
      </View>
    </View>
  );
}
