import { useState } from "react";
import { View } from "react-native";

import { useTone } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import type { CalendarRecordType } from "@/lib/local-store";
import { formatDays, monthlyTargetFor, type MonthPoint, type MonthSlot } from "@/lib/report";

import { CalloutRow } from "./callout-row";
import { useLeaveColor } from "./leave-color";
import { StackedColumns } from "./stacked-columns";

export const PENDING_OPACITY = 0.38;

/**
 * One allowance's months: approved days solid and pending days light in the leave type's colour,
 * with a dashed even-pace line when the window is one allowance year.
 */
export function QuotaChart({
  type,
  slots,
  series,
  quota,
}: {
  type: CalendarRecordType;
  slots: MonthSlot[];
  series: MonthPoint[];
  quota: number;
}) {
  const { t } = useTranslation();
  const labels = t.report.member;
  const [selected, setSelected] = useState<number | null>(null);
  const color = useLeaveColor(type);
  const guideColor = useTone("primary");
  const target = monthlyTargetFor(slots, quota);
  const days = (value: number) => formatDays(value, t.common.decimalSeparator);
  const title = (index: number) => {
    const slot = slots[index];
    return slot ? `${t.calendar.months[slot.month - 1]} ${slot.year}` : "";
  };

  return (
    <StackedColumns
      testID={`quota-chart-${type}`}
      slots={slots}
      height={150}
      columns={series.map((point) => [
        { key: "approved", value: point.used, color },
        { key: "pending", value: point.pending, color, opacity: PENDING_OPACITY },
      ])}
      guide={target > 0 ? { value: target, color: guideColor } : undefined}
      selected={selected}
      onSelect={setSelected}
      label={(index) =>
        labels.columnLabel(
          title(index),
          days(series[index]?.used ?? 0),
          days(series[index]?.pending ?? 0)
        )
      }
      callout={(index) => {
        const point = series[index];
        return (
          <View>
            <CalloutRow label={title(index)} strong />
            <CalloutRow color={color} label={labels.approved} value={days(point?.used ?? 0)} />
            {point && point.pending > 0 ? (
              <CalloutRow
                color={color}
                colorOpacity={PENDING_OPACITY}
                label={labels.pending}
                value={days(point.pending)}
              />
            ) : null}
            {target > 0 ? <CalloutRow label={labels.evenPace} value={days(target)} /> : null}
          </View>
        );
      }}
    />
  );
}
