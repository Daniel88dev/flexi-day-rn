import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { useTranslation } from "@/i18n/use-translation";
import {
  periodChoices,
  pickLabel,
  pickWithGroups,
  togglePick,
  trailingMonths,
  uniqueMembers,
  visiblePeople,
  windowLabel,
  type OverviewFilters,
  type ReportPeriod,
  type ReportScope,
} from "@/lib/report";
import { useToday } from "@/lib/use-today";

import { FilterChip } from "./filter-chip";
import { OptionSheet, type SheetOption } from "./option-sheet";
import { ReportAvatar } from "./report-avatar";

export function PeriodChip({
  testID,
  period,
  years,
  onChange,
}: {
  testID: string;
  period: ReportPeriod;
  years: number[];
  onChange: (period: ReportPeriod) => void;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const [open, setOpen] = useState(false);
  const labels = t.report.filters;
  const label = period === "rolling" ? t.report.periodRolling : String(period);

  const options: SheetOption[] = periodChoices(years, today).map((choice) =>
    choice === "rolling"
      ? {
          value: "rolling",
          label: t.report.periodRolling,
          hint: windowLabel(trailingMonths(today), t.calendar.monthsShort, t.report.windowRange),
        }
      : {
          value: String(choice),
          label: String(choice),
          hint: choice === today.getFullYear() ? labels.thisYearHint : labels.yearHint,
        }
  );

  return (
    <>
      <FilterChip
        testID={testID}
        name={labels.period}
        label={label}
        active={period !== "rolling"}
        onPress={() => setOpen(true)}
      />
      <OptionSheet
        testID={`${testID.replace(/^report-/, "")}-sheet`}
        open={open}
        onClose={() => setOpen(false)}
        title={labels.period}
        options={options}
        picked={[String(period)]}
        onPick={(value) => {
          if (value) onChange(value === "rolling" ? "rolling" : Number(value));
          setOpen(false);
        }}
      />
    </>
  );
}

/** The period chip alone, above a cold offline state the person reached by moving it. */
export function PeriodControls({
  period,
  years,
  onChange,
}: {
  period: ReportPeriod;
  years: number[];
  onChange: (period: ReportPeriod) => void;
}) {
  return (
    <View className="flex-row px-4 pt-1">
      <PeriodChip testID="member-period" period={period} years={years} onChange={onChange} />
    </View>
  );
}

const picker =
  (picked: string[], options: SheetOption[], apply: (next: string[]) => void) =>
  (value: string | null) =>
    apply(
      value === null
        ? []
        : togglePick(
            picked,
            value,
            options.map((option) => option.value)
          )
    );

export function ReportFilterBar({
  scope,
  colors,
  filters,
  onChange,
}: {
  scope: ReportScope;
  colors: Record<string, string>;
  filters: OverviewFilters;
  onChange: (filters: OverviewFilters) => void;
}) {
  const { t } = useTranslation();
  const labels = t.report.filters;
  const [sheet, setSheet] = useState<"groups" | "people" | null>(null);

  const groupOptions = useMemo<SheetOption[]>(
    () =>
      scope.groups.map((group) => ({
        value: group.groupId,
        label: group.groupName,
        hint: labels.peopleCount(
          uniqueMembers(scope.members.filter((member) => member.groupId === group.groupId)).length
        ),
      })),
    [scope, labels]
  );
  const people = useMemo(() => visiblePeople(scope, filters.groupIds), [scope, filters.groupIds]);
  const peopleOptions: SheetOption[] = people.map(({ member, groupNames }) => ({
    value: member.id,
    label: member.name,
    hint: groupNames.join(", "),
    leading: (
      <ReportAvatar user={member} color={colors[member.id] ?? member.avatarColor} size={30} />
    ),
  }));

  const groupNames = new Map(scope.groups.map((group) => [group.groupId, group.groupName]));
  const personNames = new Map(scope.members.map((member) => [member.id, member.name]));
  const groupsLabel = pickLabel(filters.groupIds, groupNames, labels.allGroups, labels.groupCount);
  const peopleLabel = pickLabel(filters.userIds, personNames, labels.everyone, labels.peopleCount);

  const pickGroup = picker(filters.groupIds, groupOptions, (groupIds) =>
    onChange(pickWithGroups(scope, filters, groupIds))
  );
  const pickPerson = picker(filters.userIds, peopleOptions, (userIds) =>
    onChange({ ...filters, userIds })
  );

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        <PeriodChip
          testID="report-period"
          period={filters.period}
          years={scope.years}
          onChange={(period) => onChange({ ...filters, period })}
        />
        {scope.groups.length > 1 ? (
          <FilterChip
            testID="report-groups"
            name={labels.groups}
            label={groupsLabel}
            active={filters.groupIds.length > 0}
            onPress={() => setSheet("groups")}
          />
        ) : null}
        <FilterChip
          testID="report-members"
          name={labels.people}
          label={peopleLabel}
          active={filters.userIds.length > 0}
          onPress={() => setSheet("people")}
        />
      </ScrollView>
      <OptionSheet
        testID="groups-sheet"
        open={sheet === "groups"}
        onClose={() => setSheet(null)}
        title={labels.groups}
        allLabel={labels.allGroups}
        options={groupOptions}
        picked={filters.groupIds}
        onPick={pickGroup}
      />
      <OptionSheet
        testID="members-sheet"
        open={sheet === "people"}
        onClose={() => setSheet(null)}
        title={labels.people}
        allLabel={labels.everyone}
        options={peopleOptions}
        picked={filters.userIds}
        onPick={pickPerson}
      />
    </>
  );
}
