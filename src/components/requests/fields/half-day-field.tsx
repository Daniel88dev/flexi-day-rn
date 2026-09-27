import { Switch, View } from "react-native";

import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

/** A single day only; the caller leaves it out for a longer request. */
export function HalfDayField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (halfDay: boolean) => void;
}) {
  const { t } = useTranslation();
  const primary = useTone("primary");
  return (
    <View>
      <View className="min-h-[52px] flex-row items-center justify-between rounded-[16px] bg-card px-4">
        <Text className="text-[15.5px] text-foreground">{t.editRequest.halfDay}</Text>
        <Switch
          testID="half-day-field"
          accessibilityLabel={t.editRequest.halfDay}
          value={value}
          onValueChange={onChange}
          trackColor={{ true: primary }}
        />
      </View>
      <Text className="px-4 pt-2 text-[12.5px] leading-[18px] text-faint">
        {t.editRequest.halfDayHint}
      </Text>
    </View>
  );
}
