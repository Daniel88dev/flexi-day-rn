import DateTimePicker from "@react-native-community/datetimepicker";
import { View } from "react-native";

import { FieldLabel } from "@/components/requests/fields/field-label";
import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dateOfDay, dayOfDate } from "@/lib/days";

/** To never opens before From; moving From past To is the caller's to resolve. */
export function DatesField({
  from,
  to,
  window,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  /** Inclusive `YYYY-MM-DD` bounds From may take. */
  window: { min: string; max: string };
  onFrom: (day: string) => void;
  onTo: (day: string) => void;
}) {
  const { t } = useTranslation();
  const primary = useTone("primary");
  const labels = t.requestForm;

  const picker = (
    label: string,
    day: string,
    min: string,
    onChange: (day: string) => void,
    testID: string
  ) => (
    <View className="min-h-[52px] flex-row items-center justify-between px-4 py-1.5">
      <Text className="text-[15.5px] text-foreground">{label}</Text>
      <DateTimePicker
        testID={testID}
        mode="date"
        display="compact"
        value={dateOfDay(day)}
        minimumDate={dateOfDay(min)}
        maximumDate={dateOfDay(window.max)}
        onValueChange={(_event, date) => onChange(dayOfDate(date))}
        accentColor={primary}
      />
    </View>
  );

  return (
    <View>
      <FieldLabel>{labels.dates}</FieldLabel>
      <View className="overflow-hidden rounded-[24px] bg-card">
        {picker(labels.fromDate, from, window.min, onFrom, "dates-field-from")}
        <View className="ml-4 h-px bg-border" />
        {picker(labels.toDate, to, from, onTo, "dates-field-to")}
      </View>
    </View>
  );
}
