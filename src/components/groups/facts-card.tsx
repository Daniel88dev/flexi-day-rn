import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { holidayCountryLabel } from "@/lib/groups/facts";
import type { MyGroup } from "@/lib/local-store";
import { useHolidayCountries } from "@/lib/query";

import { WeekdayPills } from "./parts";

type Facts = Pick<
  MyGroup,
  "workingDays" | "holidayCountry" | "defaultVacationDays" | "defaultHomeOfficeDays"
>;

function FactRow({
  label,
  testID,
  children,
}: {
  label: string;
  testID: string;
  children: ReactNode;
}) {
  return (
    <View
      testID={testID}
      className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-2.5"
    >
      <Text className="text-[15px] text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

const Hairline = () => <View className="ml-4 h-px bg-border" />;

export function FactsCard({ facts }: { facts: Facts }) {
  const { t } = useTranslation();
  const labels = t.groups.facts;
  const countries = useHolidayCountries({ enabled: facts.holidayCountry !== null });
  const country = holidayCountryLabel(facts.holidayCountry, countries.data);

  return (
    <View testID="group-facts" className="overflow-hidden rounded-[24px] bg-card">
      <FactRow testID="group-facts-working-days" label={labels.workingDays}>
        <WeekdayPills workingDays={facts.workingDays} />
      </FactRow>
      <Hairline />
      <FactRow testID="group-facts-holiday-country" label={labels.holidayCountry}>
        <Text className="shrink text-right text-[15px] font-semibold text-foreground">
          {country ?? labels.none}
        </Text>
      </FactRow>
      <Hairline />
      <FactRow testID="group-facts-allowance" label={labels.defaultAllowance}>
        <Text
          className="shrink text-right text-[15px] font-semibold text-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {labels.allowance(facts.defaultVacationDays, facts.defaultHomeOfficeDays)}
        </Text>
      </FactRow>
    </View>
  );
}
