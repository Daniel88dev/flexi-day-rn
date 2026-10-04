import { useState } from "react";
import { Pressable, View } from "react-native";

import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { formatDays, type ReportScopeMember, type TeamMonthRow } from "@/lib/report";

import { StackedColumns } from "./stacked-columns";

function Dot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

function CalloutRow({
  color,
  label,
  value,
  strong,
}: {
  color?: string;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2 py-[2px]">
      {color ? <Dot color={color} /> : null}
      <Text
        numberOfLines={1}
        className={cn(
          "flex-1 text-[12.5px]",
          strong ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </Text>
      <Text
        style={TABULAR}
        className={cn("text-[12.5px] text-foreground", strong && "font-semibold")}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The team's monthly columns stacked by person. Legend chips hide people from this chart only;
 * remount it to reset them.
 */
export function UsageChart({
  series,
  members,
  colors,
}: {
  series: TeamMonthRow[];
  members: ReportScopeMember[];
  colors: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const days = (value: number) => formatDays(value, t.common.decimalSeparator);
  const colorOf = (member: ReportScopeMember) => colors[member.id] ?? member.avatarColor;

  const visible = members.filter((member) => !hidden.has(member.id));
  const columns = series.map((row) =>
    visible.map((member) => ({
      key: member.id,
      value: row.values[member.id] ?? 0,
      color: colorOf(member),
    }))
  );
  const total = (index: number) =>
    columns[index]?.reduce((sum, segment) => sum + segment.value, 0) ?? 0;
  const entries = (index: number) =>
    [...visible]
      .reverse()
      .map((member) => ({ member, value: series[index]?.values[member.id] ?? 0 }))
      .filter((entry) => entry.value > 0);
  const title = (index: number) => {
    const slot = series[index];
    return slot ? `${t.calendar.months[slot.month - 1]} ${slot.year}` : "";
  };

  const toggle = (id: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View>
      <StackedColumns
        testID="usage-chart"
        slots={series}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        label={(index) =>
          t.report.columnLabel(
            title(index),
            total(index),
            days(total(index)),
            entries(index).map(({ member, value }) => `${member.name} ${days(value)}`)
          )
        }
        callout={(index) => {
          const people = entries(index);
          return (
            <View>
              <CalloutRow
                label={title(index)}
                value={t.report.daysShort(days(total(index)))}
                strong
              />
              {people.length === 0 ? (
                <Text className="pt-0.5 text-[12.5px] text-faint">{t.report.nobodyTookLeave}</Text>
              ) : (
                people.map(({ member, value }) => (
                  <CalloutRow
                    key={member.id}
                    color={colorOf(member)}
                    label={member.name}
                    value={days(value)}
                  />
                ))
              )}
            </View>
          );
        }}
      />
      {members.length > 1 ? (
        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {members.map((member) => {
            const shown = !hidden.has(member.id);
            return (
              <Pressable
                key={member.id}
                testID={`usage-legend-${member.id}`}
                accessibilityRole="switch"
                accessibilityLabel={member.name}
                accessibilityState={{ checked: shown }}
                onPress={() => toggle(member.id)}
                style={{ opacity: shown ? 1 : 0.45 }}
                className="flex-row items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-2 active:opacity-70"
              >
                <Dot color={colorOf(member)} />
                <Text className="text-[12px] text-foreground">{member.name.split(" ")[0]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
