import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { useTone } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  axisLabel,
  bands,
  calloutSpan,
  formatDays,
  niceScale,
  roundedTopRect,
  type MonthSlot,
} from "@/lib/report";

export type Segment = { key: string; value: number; color: string };

const AXIS = 24;
const LABELS = 30;
const CALLOUT = { ideal: 184, min: 140, gap: 4 };

/**
 * Monthly columns of stacked segments. Transparent pressables over the drawing carry each
 * column's testID, label and selected state; a tap opens the callout beside the column.
 */
export function StackedColumns({
  testID,
  slots,
  columns,
  selected,
  onSelect,
  label,
  callout,
  height = 168,
}: {
  testID: string;
  slots: MonthSlot[];
  columns: Segment[][];
  selected: number | null;
  onSelect: (index: number | null) => void;
  label: (index: number) => string;
  callout: (index: number) => ReactNode;
  height?: number;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const grid = useTone("faint");
  const highlight = useTone("foreground");

  const plotWidth = Math.max(0, width - AXIS);
  const plotHeight = height - LABELS;
  const totals = columns.map((segments) => segments.reduce((sum, s) => sum + s.value, 0));
  const { top, ticks } = niceScale(Math.max(0, ...totals));
  const y = (value: number) => plotHeight - (value / top) * (plotHeight - 8);
  const cols = bands(columns.length, plotWidth, 0.38);
  const picked = selected === null ? undefined : cols[selected];

  const span =
    picked && selected !== null
      ? calloutSpan(picked, selected < columns.length / 2, width, AXIS, CALLOUT)
      : { left: 0, width: CALLOUT.ideal };

  return (
    <View
      testID={testID}
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      style={{ height }}
    >
      {width > 0 ? (
        <>
          {ticks.map((tick) => (
            <Text
              key={tick}
              style={[
                { position: "absolute", left: 0, top: y(tick) - 7, width: AXIS - 6 },
                TABULAR,
              ]}
              className="text-right text-[10.5px] text-faint"
            >
              {formatDays(tick, t.common.decimalSeparator)}
            </Text>
          ))}
          <Svg
            width={plotWidth}
            height={plotHeight}
            style={{ position: "absolute", left: AXIS, top: 0 }}
          >
            {ticks.map((tick) => (
              <Line
                key={tick}
                x1={0}
                x2={plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke={grid}
                strokeOpacity={tick === 0 ? 0.5 : 0.22}
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
            ))}
            {picked ? (
              <Rect
                x={picked.slotX + 1}
                y={0}
                width={picked.slotWidth - 2}
                height={plotHeight}
                rx={8}
                fill={highlight}
                opacity={0.06}
              />
            ) : null}
            {columns.map((segments, index) => {
              const col = cols[index];
              const drawn = segments.filter((segment) => segment.value > 0);
              const opacity = selected !== null && selected !== index ? 0.35 : 1;
              let base = 0;
              return drawn.map((segment, layer) => {
                const bottom = y(base);
                base += segment.value;
                const topEdge = y(base);
                const last = layer === drawn.length - 1;
                const h = Math.max(0, bottom - topEdge - (last ? 0 : 1));
                return last ? (
                  <Path
                    key={segment.key}
                    d={roundedTopRect(col.x, topEdge, col.width, h, 3.5)}
                    fill={segment.color}
                    opacity={opacity}
                  />
                ) : (
                  <Rect
                    key={segment.key}
                    x={col.x}
                    y={topEdge}
                    width={col.width}
                    height={h}
                    fill={segment.color}
                    opacity={opacity}
                  />
                );
              });
            })}
          </Svg>
          {cols.map((col, index) => {
            const axis = axisLabel(slots, index, t.calendar.monthsShort);
            return (
              <View
                key={`${slots[index]?.year}-${slots[index]?.month}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: AXIS + col.slotX,
                  top: plotHeight + 6,
                  width: col.slotWidth,
                }}
                className="items-center"
              >
                <Text
                  className={cn(
                    "text-[10.5px]",
                    selected === index ? "font-semibold text-foreground" : "text-faint"
                  )}
                >
                  {axis.month}
                </Text>
                {axis.year ? <Text className="text-[9.5px] text-faint">{axis.year}</Text> : null}
              </View>
            );
          })}
        </>
      ) : null}
      <View
        style={{ position: "absolute", left: AXIS, right: 0, top: 0, bottom: 0 }}
        className="flex-row"
      >
        {columns.map((_, index) => (
          <Pressable
            key={`${slots[index]?.year}-${slots[index]?.month}`}
            testID={`${testID}-col-${index}`}
            accessibilityRole="button"
            accessibilityLabel={label(index)}
            accessibilityState={{ selected: selected === index }}
            onPress={() => onSelect(selected === index ? null : index)}
            className="flex-1"
          />
        ))}
      </View>
      {selected !== null ? (
        <View
          testID={`${testID}-tip`}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", left: span.left, top: 0, width: span.width }}
          className="rounded-[16px] border border-border bg-card px-3 py-2.5 shadow-md elevation-md"
        >
          {callout(selected)}
        </View>
      ) : null}
    </View>
  );
}
