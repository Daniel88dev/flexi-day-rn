import { Pressable } from "react-native";

import { dayOfDate } from "@/lib/days";

/**
 * `@react-native-community/datetimepicker` as a button: a press moves a time picker on half an
 * hour and a date picker two days. A date picker shows its day as its value and its bounds as its
 * hint, `min..max`.
 */
export function FakeDateTimePicker(props: {
  testID: string;
  mode: "date" | "time";
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onValueChange: (event: unknown, date: Date) => void;
}) {
  const dates = props.mode === "date";
  const bound = (date?: Date) => (date ? dayOfDate(date) : "");
  return (
    <Pressable
      testID={props.testID}
      accessibilityValue={{
        text: dates ? dayOfDate(props.value) : props.value.toTimeString().slice(0, 5),
      }}
      accessibilityHint={
        dates ? `${bound(props.minimumDate)}..${bound(props.maximumDate)}` : undefined
      }
      onPress={() => {
        const later = new Date(props.value);
        if (dates) later.setDate(later.getDate() + 2);
        else later.setMinutes(later.getMinutes() + 30);
        props.onValueChange({ type: "set" }, later);
      }}
    />
  );
}
