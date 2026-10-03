// PROTOTYPE (T-143, prototype/report): the filters at phone width.
// Variant A: a row of chips, each opening its own sheet. Variant B: the period chip plus one
// "Filters" button opening a single sheet with groups, members and leave types.
import { FunnelSimpleIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";

import { FILTERABLE_TYPES, type Proto } from "./data";
import { Avatar, FilterChip, OptionSheet, type Option } from "./parts";
import { uniqueMembers } from "./series";
import type { ReportFilters, ReportPeriod, ReportScope } from "./types";

export const periodLabel = (period: ReportPeriod) =>
  period === "rolling" ? "Last 12 months" : String(period);

export function PeriodControl({
  proto,
  period,
  years,
  onChange,
  testID,
}: {
  proto: Proto;
  period: ReportPeriod;
  years: number[];
  onChange: (period: ReportPeriod) => void;
  testID: string;
}) {
  const [open, setOpen] = useState(proto.sheet === "period");
  return (
    <View className="flex-row">
      <FilterChip
        testID={testID}
        label={periodLabel(period)}
        active={period !== "rolling"}
        onPress={() => setOpen(true)}
      />
      <PeriodSheet
        open={open}
        onClose={() => setOpen(false)}
        period={period}
        years={years}
        onChange={onChange}
      />
    </View>
  );
}

function PeriodSheet({
  open,
  onClose,
  period,
  years,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  period: ReportPeriod;
  years: number[];
  onChange: (period: ReportPeriod) => void;
}) {
  const now = new Date();
  const back = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const short = (d: Date) => d.toLocaleString("en", { month: "short", year: "numeric" });
  const options: Option[] = [
    { value: "rolling", label: "Last 12 months", hint: `${short(back)} to ${short(now)}` },
    ...[...years]
      .sort((a, b) => b - a)
      .map((year) => ({
        value: String(year),
        label: String(year),
        hint: year === now.getFullYear() ? "January to December, this year" : "January to December",
      })),
  ];
  return (
    <OptionSheet
      testID="period-sheet"
      open={open}
      onClose={onClose}
      title="Period"
      options={options}
      selected={[String(period)]}
      multiple={false}
      onChange={([value]) => onChange(value === "rolling" || !value ? "rolling" : Number(value))}
    />
  );
}

function groupOptions(scope: ReportScope): Option[] {
  return scope.groups.map((g) => ({
    value: g.groupId,
    label: g.groupName,
    hint: `${uniqueMembers(scope.members.filter((m) => m.groupId === g.groupId)).length} people`,
  }));
}

function memberOptions(scope: ReportScope, groupIds: string[]): Option[] {
  return uniqueMembers(
    scope.members.filter((m) => groupIds.length === 0 || groupIds.includes(m.groupId))
  ).map((m) => ({
    value: m.id,
    label: m.name,
    hint: scope.groups.find((g) => g.groupId === m.groupId)?.groupName,
    leading: <Avatar user={m} size={30} />,
  }));
}

function narrowMembers(scope: ReportScope, filters: ReportFilters, groupIds: string[]) {
  const visible = new Set(
    scope.members
      .filter((m) => groupIds.length === 0 || groupIds.includes(m.groupId))
      .map((m) => m.id)
  );
  return { ...filters, groupIds, userIds: filters.userIds.filter((id) => visible.has(id)) };
}

const pickLabel = (selected: string[], options: Option[], all: string, plural: string) => {
  if (selected.length === 0) return all;
  if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label ?? all;
  return `${selected.length} ${plural}`;
};

export function FilterBar({
  proto,
  scope,
  filters,
  onFilters,
  period,
  onPeriod,
}: {
  proto: Proto;
  scope: ReportScope;
  filters: ReportFilters;
  onFilters: (filters: ReportFilters) => void;
  period: ReportPeriod;
  onPeriod: (period: ReportPeriod) => void;
}) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<string | null>(proto.sheet);
  const groups = groupOptions(scope);
  const members = memberOptions(scope, filters.groupIds);
  const years = scope.years.length ? scope.years : [new Date().getFullYear()];
  const showGroups = scope.groups.length > 1;

  const periodSheet = (
    <PeriodSheet
      open={sheet === "period"}
      onClose={() => setSheet(null)}
      period={period}
      years={years}
      onChange={onPeriod}
    />
  );

  if (proto.variant === "B") {
    const count =
      (filters.groupIds.length ? 1 : 0) +
      (filters.userIds.length ? 1 : 0) +
      (filters.types.length ? 1 : 0);
    return (
      <View className="flex-row items-center gap-2 px-4">
        <FilterChip
          testID="report-period"
          label={periodLabel(period)}
          active={period !== "rolling"}
          onPress={() => setSheet("period")}
        />
        <Pressable
          testID="report-filters"
          onPress={() => setSheet("filters")}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          className={cn(
            "h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 active:opacity-70",
            count ? "border-transparent bg-accent" : "border-border bg-card"
          )}
        >
          <Icon icon={FunnelSimpleIcon} tone={count ? "primary" : "foreground"} size={16} />
          <Text
            className={cn("text-[14px] font-medium", count ? "text-primary" : "text-foreground")}
          >
            Filters
          </Text>
          {count ? (
            <View className="h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-[11px] font-bold text-primary-foreground">{count}</Text>
            </View>
          ) : null}
        </Pressable>
        {periodSheet}
        <BottomSheet
          open={sheet === "filters"}
          onClose={() => setSheet(null)}
          closeLabel="Close"
          testID="filters-sheet"
        >
          <View className="flex-row items-center justify-between px-5 pt-1 pb-1">
            <Text className="font-display text-[18px] font-semibold text-foreground">Filters</Text>
            <Pressable
              testID="filters-sheet-reset"
              hitSlop={8}
              onPress={() => onFilters({ groupIds: [], userIds: [], types: [] })}
            >
              <Text className="text-[15px] font-semibold text-primary">Reset</Text>
            </Pressable>
          </View>
          <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 20 }}>
            {showGroups ? (
              <ChipGroup
                title="Groups"
                options={groups}
                selected={filters.groupIds}
                onChange={(ids) => onFilters(narrowMembers(scope, filters, ids))}
                testID="filters-group"
              />
            ) : null}
            <ChipGroup
              title="People"
              options={members}
              selected={filters.userIds}
              onChange={(userIds) => onFilters({ ...filters, userIds })}
              testID="filters-member"
            />
            <ChipGroup
              title="Leave types"
              options={FILTERABLE_TYPES.map((type) => ({
                value: type,
                label: t.recordTypes[type],
              }))}
              selected={filters.types}
              onChange={(types) => onFilters({ ...filters, types: types as CalendarRecordType[] })}
              testID="filters-type"
              dots
            />
          </ScrollView>
        </BottomSheet>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        <FilterChip
          testID="report-period"
          label={periodLabel(period)}
          active={period !== "rolling"}
          onPress={() => setSheet("period")}
        />
        {showGroups ? (
          <FilterChip
            testID="report-groups"
            label={pickLabel(filters.groupIds, groups, "All groups", "groups")}
            active={filters.groupIds.length > 0}
            onPress={() => setSheet("groups")}
          />
        ) : null}
        <FilterChip
          testID="report-members"
          label={pickLabel(filters.userIds, members, "Everyone", "people")}
          active={filters.userIds.length > 0}
          onPress={() => setSheet("members")}
        />
      </ScrollView>
      {periodSheet}
      <OptionSheet
        testID="groups-sheet"
        open={sheet === "groups"}
        onClose={() => setSheet(null)}
        title="Groups"
        allLabel="All groups"
        options={groups}
        selected={filters.groupIds}
        multiple
        onChange={(ids) => onFilters(narrowMembers(scope, filters, ids))}
      />
      <OptionSheet
        testID="members-sheet"
        open={sheet === "members"}
        onClose={() => setSheet(null)}
        title="People"
        allLabel="Everyone"
        options={members}
        selected={filters.userIds}
        multiple
        onChange={(userIds) => onFilters({ ...filters, userIds })}
      />
    </View>
  );
}

function ChipGroup({
  title,
  options,
  selected,
  onChange,
  testID,
  dots,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  testID: string;
  dots?: boolean;
}) {
  return (
    <View className="pt-4">
      <Text className="pb-2 text-[13px] font-semibold text-muted-foreground">{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          testID={`${testID}-all`}
          onPress={() => onChange([])}
          className={cn(
            "h-9 justify-center rounded-full border px-3.5",
            selected.length === 0 ? "border-transparent bg-primary" : "border-border bg-card"
          )}
        >
          <Text
            className={cn(
              "text-[14px] font-medium",
              selected.length === 0 ? "text-primary-foreground" : "text-foreground"
            )}
          >
            All
          </Text>
        </Pressable>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Pressable
              key={o.value}
              testID={`${testID}-${o.value}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() =>
                onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])
              }
              className={cn(
                "h-9 flex-row items-center gap-1.5 rounded-full border px-3.5",
                on ? "border-transparent bg-accent" : "border-border bg-card"
              )}
            >
              {dots ? (
                <View
                  className={cn(
                    "h-2 w-2 rounded-full",
                    LEAVE_CLASSES[o.value as CalendarRecordType].fill
                  )}
                />
              ) : null}
              <Text
                className={cn("text-[14px]", on ? "font-semibold text-primary" : "text-foreground")}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TypeTabs({
  types,
  value,
  onChange,
}: {
  types: CalendarRecordType[];
  value: CalendarRecordType;
  onChange: (type: CalendarRecordType) => void;
}) {
  const { t } = useTranslation();
  if (types.length < 2) return null;
  return (
    <View className="mx-4 flex-row rounded-full bg-muted p-1">
      {types.map((type) => {
        const on = type === value;
        return (
          <Pressable
            key={type}
            testID={`report-type-${type}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(type)}
            className={cn(
              "h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full",
              on && "bg-card shadow-sm elevation-sm"
            )}
          >
            <View className={cn("h-2 w-2 rounded-full", LEAVE_CLASSES[type].fill)} />
            <Text
              numberOfLines={1}
              className={cn(
                "text-[13.5px]",
                on ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {t.recordTypes[type]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
