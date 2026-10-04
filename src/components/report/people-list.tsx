import { CaretRightIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";
import {
  formatDays,
  usageParts,
  type DaysLeftScale,
  type MemberRemaining,
  type PeopleSection,
} from "@/lib/report";

import { DaysLeftBar } from "./days-left-bar";
import { ReportAvatar } from "./report-avatar";

function PersonRow({
  row,
  first,
  scale,
  type,
  color,
  onPress,
}: {
  row: MemberRemaining;
  first: boolean;
  scale: DaysLeftScale;
  type: CalendarRecordType;
  color: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const days = (value: number) => formatDays(value, t.common.decimalSeparator);
  const left = days(row.remaining);
  const of = days(row.carriedOver + row.yearQuota);
  const parts = usageParts(row)
    .map(({ part, days: value }) => t.report[part](days(value)))
    .join(", ");

  return (
    <Pressable
      testID={`member-row-${row.member.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.report.rowLabel(row.member.name, row.remaining, left, of)}
      className={cn(
        "flex-row items-center gap-3 py-3 active:opacity-60",
        !first && "border-t border-border"
      )}
    >
      <ReportAvatar user={row.member} color={color} />
      <View className="flex-1">
        <Text numberOfLines={1} className="text-[15.5px] font-medium text-foreground">
          {row.member.name}
        </Text>
        <DaysLeftBar row={row} scale={scale} type={type} />
        {parts ? (
          <Text numberOfLines={1} className="mt-1 text-[12.5px] text-faint">
            {parts}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text
          style={TABULAR}
          className={cn(
            "font-display text-[19px] leading-[22px] font-semibold",
            row.remaining < 0 ? "text-danger" : "text-foreground"
          )}
        >
          {left}
        </Text>
        <Text style={TABULAR} className="text-[11.5px] text-faint">
          {t.report.of(of)}
        </Text>
      </View>
      <Icon icon={CaretRightIcon} tone="faint" size={14} weight="bold" />
    </Pressable>
  );
}

export function PeopleList({
  section,
  year,
  scale,
  type,
  colors,
  onOpen,
}: {
  section: PeopleSection;
  year: number;
  scale: DaysLeftScale;
  type: CalendarRecordType;
  colors: Record<string, string>;
  onOpen: (userId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View testID={`people-${section.group.groupId}`}>
      <View className="flex-row items-baseline justify-between gap-3 px-1 pt-2 pb-2">
        <Text
          numberOfLines={1}
          className="font-display flex-1 text-[17px] font-semibold text-foreground"
        >
          {section.group.groupName}
        </Text>
        <Text className="text-[13px] text-faint">
          {t.report.peopleMeta(section.rows.length, year)}
        </Text>
      </View>
      <View className="rounded-[24px] border border-border bg-card px-4 py-1">
        {section.rows.map((row, index) => (
          <PersonRow
            key={row.member.id}
            row={row}
            first={index === 0}
            scale={scale}
            type={type}
            color={colors[row.member.id] ?? row.member.avatarColor}
            onPress={() => onOpen(row.member.id)}
          />
        ))}
      </View>
    </View>
  );
}
