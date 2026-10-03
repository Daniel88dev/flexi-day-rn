// PROTOTYPE (T-143, prototype/report): the three report charts, hand-drawn with react-native-svg
// and a row of transparent Pressables over each for tap tooltips and accessibility (T-139).
import { useUnstableNativeVariable } from "nativewind";
import { useState, type ReactNode } from "react";
import { Pressable, View, useColorScheme, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { useTone } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";

import {
  MONTHS_LONG,
  axisLabel,
  bands,
  formatDays,
  monthlyTargetFor,
  niceScale,
  roundedRightRect,
  roundedTopRect,
  type MemberRemaining,
  type MonthPoint,
  type MonthSlot,
  type TeamMonthRow,
} from "./series";
import type { ReportScopeMember } from "./types";

const LEAVE_VAR: Record<CalendarRecordType, [string, string, string]> = {
  VACATION: ["--c-vacation", "#7a69d6", "#9b8ef0"],
  HOME_OFFICE: ["--c-home", "#3f9a73", "#5fc394"],
  SICK: ["--c-sick", "#d5566a", "#ec7f89"],
  SICK_DAY: ["--c-sickday", "#cf5a8c", "#ea83ad"],
  BANK_HOLIDAY: ["--c-bank", "#d29a3a", "#ebb862"],
  PAID_TIME_OFF: ["--c-pto", "#3d86c0", "#6aa9de"],
  NON_PAID_LEAVE: ["--c-nonpaid", "#3d97a7", "#6cc0cc"],
  STUDY_LEAVE: ["--c-study", "#8aa337", "#aec85a"],
  OTHER: ["--c-other", "#7c7d8a", "#a7a8b5"],
};

export function useLeaveColor(type: CalendarRecordType): string {
  const [name, light, dark] = LEAVE_VAR[type];
  const value = (useUnstableNativeVariable as unknown as (n: string) => unknown)(name);
  const scheme = useColorScheme();
  return typeof value === "string" ? value : scheme === "dark" ? dark : light;
}

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

type Segment = { value: number; color: string; opacity?: number };

const AXIS = 24;
const LABELS = 30;
const TIP_WIDTH = 176;

function StackedColumns({
  slots,
  columns,
  guide = 0,
  guideColor,
  height = 168,
  selected,
  onSelect,
  tip,
  a11y,
  testID,
}: {
  slots: MonthSlot[];
  columns: Segment[][];
  guide?: number;
  guideColor?: string;
  height?: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
  tip: (index: number) => ReactNode;
  a11y: (index: number) => string;
  testID: string;
}) {
  const [width, onLayout] = useWidth();
  const grid = useTone("faint");
  const highlight = useTone("foreground");
  const plotW = Math.max(0, width - AXIS);
  const plotH = height - LABELS;
  const totals = columns.map((c) => c.reduce((t, s) => t + s.value, 0));
  const { top, ticks } = niceScale(Math.max(guide, ...totals, 1));
  const y = (v: number) => plotH - (v / top) * (plotH - 8);
  const cols = bands(columns.length, plotW, 0.38);

  const sel = selected === null ? null : cols[selected];
  const tipLeft =
    sel === undefined || sel === null
      ? 0
      : selected! < columns.length / 2
        ? Math.min(AXIS + sel.slotX + sel.slotWidth + 4, width - TIP_WIDTH)
        : Math.max(0, AXIS + sel.slotX - TIP_WIDTH - 4);

  return (
    <View testID={testID} onLayout={onLayout} style={{ height }}>
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
              {formatDays(tick)}
            </Text>
          ))}
          <Svg width={plotW} height={plotH} style={{ position: "absolute", left: AXIS, top: 0 }}>
            {ticks.map((tick) => (
              <Line
                key={tick}
                x1={0}
                x2={plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke={grid}
                strokeOpacity={tick === 0 ? 0.5 : 0.22}
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
            ))}
            {sel ? (
              <Rect
                x={sel.slotX + 1}
                y={0}
                width={sel.slotWidth - 2}
                height={plotH}
                rx={8}
                fill={highlight}
                opacity={0.06}
              />
            ) : null}
            {columns.map((segments, i) => {
              const col = cols[i];
              let base = 0;
              const drawn = segments.filter((s) => s.value > 0);
              const dim = selected !== null && selected !== i;
              return drawn.map((s, j) => {
                const y0 = y(base);
                base += s.value;
                const y1 = y(base);
                const h = Math.max(0, y0 - y1 - (j < drawn.length - 1 ? 1 : 0));
                const props = {
                  fill: s.color,
                  opacity: (s.opacity ?? 1) * (dim ? 0.35 : 1),
                };
                return j === drawn.length - 1 ? (
                  <Path key={j} d={roundedTopRect(col.x, y1, col.width, h, 3.5)} {...props} />
                ) : (
                  <Rect key={j} x={col.x} y={y1} width={col.width} height={h} {...props} />
                );
              });
            })}
            {guide > 0 ? (
              <Line
                x1={0}
                x2={plotW}
                y1={y(guide)}
                y2={y(guide)}
                stroke={guideColor}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeOpacity={0.8}
              />
            ) : null}
          </Svg>
          {cols.map((col, i) => {
            const label = axisLabel(slots, i);
            return (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: AXIS + col.slotX,
                  top: plotH + 6,
                  width: col.slotWidth,
                }}
                className="items-center"
              >
                <Text
                  className={cn(
                    "text-[10.5px]",
                    selected === i ? "font-semibold text-foreground" : "text-faint"
                  )}
                >
                  {label.month}
                </Text>
                {label.year ? <Text className="text-[9.5px] text-faint">{label.year}</Text> : null}
              </View>
            );
          })}
          <View
            style={{ position: "absolute", left: AXIS, top: 0, width: plotW, height }}
            className="flex-row"
          >
            {cols.map((col, i) => (
              <Pressable
                key={i}
                testID={`${testID}-col-${i}`}
                accessibilityRole="button"
                accessibilityLabel={a11y(i)}
                accessibilityState={{ selected: selected === i }}
                onPress={() => onSelect(selected === i ? null : i)}
                style={{ width: col.slotWidth, height }}
              />
            ))}
          </View>
          {selected !== null && sel ? (
            <View
              pointerEvents="none"
              testID={`${testID}-tip`}
              style={{ position: "absolute", left: tipLeft, top: 0, width: TIP_WIDTH }}
              className="rounded-[16px] border border-border bg-card px-3 py-2.5 shadow-md elevation-md"
            >
              {tip(selected)}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function TipRow({
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
      {color ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      ) : null}
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

const monthTitle = (slot: MonthSlot | undefined) =>
  slot ? `${MONTHS_LONG[slot.month - 1]} ${slot.year}` : "";

export function UsageChart({
  slots,
  series,
  members,
  colors,
  initialTip = null,
}: {
  slots: MonthSlot[];
  series: TeamMonthRow[];
  members: ReportScopeMember[];
  colors: Record<string, string>;
  initialTip?: number | null;
}) {
  const [selected, setSelected] = useState<number | null>(initialTip);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const visible = members.filter((m) => !hidden.has(m.id));
  const columns = series.map((row) =>
    visible.map((m) => ({ value: row.values[m.id] ?? 0, color: colors[m.id] ?? "#888" }))
  );
  const total = (i: number) => columns[i]?.reduce((t, s) => t + s.value, 0) ?? 0;

  return (
    <View>
      <StackedColumns
        testID="usage-chart"
        slots={slots}
        columns={columns}
        selected={selected}
        onSelect={setSelected}
        a11y={(i) => `${monthTitle(slots[i])}: ${formatDays(total(i))} days`}
        tip={(i) => {
          const row = series[i];
          const entries = [...visible]
            .reverse()
            .map((m) => ({ m, value: row?.values[m.id] ?? 0 }))
            .filter((e) => e.value > 0);
          return (
            <View>
              <TipRow label={monthTitle(slots[i])} value={`${formatDays(total(i))} d`} strong />
              {entries.length === 0 ? (
                <Text className="pt-0.5 text-[12.5px] text-faint">Nobody took leave</Text>
              ) : (
                entries.map(({ m, value }) => (
                  <TipRow
                    key={m.id}
                    color={colors[m.id]}
                    label={m.name}
                    value={formatDays(value)}
                  />
                ))
              )}
            </View>
          );
        }}
      />
      {members.length > 1 ? (
        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {members.map((m) => {
            const off = hidden.has(m.id);
            return (
              <Pressable
                key={m.id}
                testID={`usage-legend-${m.id}`}
                accessibilityRole="switch"
                accessibilityState={{ checked: !off }}
                accessibilityLabel={`Show ${m.name}`}
                onPress={() =>
                  setHidden((cur) => {
                    const next = new Set(cur);
                    if (next.has(m.id)) next.delete(m.id);
                    else next.add(m.id);
                    return next;
                  })
                }
                className="flex-row items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-2 active:opacity-70"
                style={{ opacity: off ? 0.45 : 1 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: off ? "#999" : colors[m.id],
                  }}
                />
                <Text className="text-[12px] text-foreground">{m.name.split(" ")[0]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function QuotaChart({
  slots,
  series,
  quota,
  type,
  initialTip = null,
}: {
  slots: MonthSlot[];
  series: MonthPoint[];
  quota: number;
  type: CalendarRecordType;
  initialTip?: number | null;
}) {
  const [selected, setSelected] = useState<number | null>(initialTip);
  const color = useLeaveColor(type);
  const guideColor = useTone("primary");
  const guide = monthlyTargetFor(slots, quota);
  return (
    <StackedColumns
      testID={`quota-chart-${type}`}
      slots={slots}
      height={150}
      columns={series.map((p) => [
        { value: p.used, color },
        { value: p.pending, color, opacity: 0.38 },
      ])}
      guide={guide}
      guideColor={guideColor}
      selected={selected}
      onSelect={setSelected}
      a11y={(i) =>
        `${monthTitle(slots[i])}: ${formatDays(series[i]?.used ?? 0)} used, ${formatDays(series[i]?.pending ?? 0)} pending`
      }
      tip={(i) => (
        <View>
          <TipRow label={monthTitle(slots[i])} value="" strong />
          <TipRow color={color} label="Approved" value={formatDays(series[i]?.used ?? 0)} />
          {(series[i]?.pending ?? 0) > 0 ? (
            <TipRow label="Pending" value={formatDays(series[i]?.pending ?? 0)} />
          ) : null}
          {guide > 0 ? (
            <TipRow label="Even pace" value={formatDays(Number(guide.toFixed(1)))} />
          ) : null}
        </View>
      )}
    />
  );
}

/** Days left per member as ranked horizontal bars: names stay readable at phone width. */
export function RemainingChart({
  rows,
  type,
  year,
  initialSelected = null,
  onOpen,
}: {
  rows: MemberRemaining[];
  type: CalendarRecordType;
  year: number;
  initialSelected?: string | null;
  onOpen?: (memberId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [width, onLayout] = useWidth();
  const color = useLeaveColor(type);
  const danger = useTone("danger");
  const track = useTone("faint");
  const pos = Math.max(1, ...rows.map((r) => r.carriedOverLeft + r.yearLeft));
  const neg = Math.max(0, ...rows.map((r) => -r.overdraft));
  const barW = Math.max(0, width);
  const scale = barW / (pos + neg);
  const zero = neg * scale;
  const anything = rows.some((r) => r.carriedOver > 0 || r.yearQuota > 0 || r.used > 0);
  const carries = rows.some((r) => r.carriedOverLeft > 0);
  const overdrawn = neg > 0;

  if (!anything) {
    return (
      <Text className="py-2 text-[14px] text-muted-foreground">
        Nobody has this allowance set up.
      </Text>
    );
  }

  return (
    <View>
      {rows.map((r) => {
        const open = selected === r.member.id;
        return (
          <Pressable
            key={r.member.id}
            testID={`remaining-row-${r.member.id}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${r.member.name}: ${formatDays(r.remaining)} days left`}
            onPress={() => setSelected(open ? null : r.member.id)}
            className={cn("-mx-2 rounded-[12px] px-2 py-2", open && "bg-muted")}
          >
            <View className="flex-row items-center gap-3">
              <Text numberOfLines={1} className="w-[84px] text-[13.5px] text-foreground">
                {r.member.name.split(" ")[0]}
              </Text>
              <View className="flex-1" onLayout={width === 0 ? onLayout : undefined}>
                <Svg width={barW} height={12}>
                  <Rect x={0} y={5.5} width={barW} height={1} fill={track} opacity={0.18} />
                  {overdrawn ? (
                    <Rect x={zero - 0.5} y={0} width={1} height={12} fill={track} opacity={0.6} />
                  ) : null}
                  {r.carriedOverLeft > 0 ? (
                    <Rect
                      x={zero}
                      y={0}
                      width={r.carriedOverLeft * scale}
                      height={12}
                      fill={color}
                      opacity={0.38}
                    />
                  ) : null}
                  {r.yearLeft > 0 ? (
                    <Path
                      d={roundedRightRect(
                        zero + r.carriedOverLeft * scale + (r.carriedOverLeft > 0 ? 1 : 0),
                        0,
                        Math.max(0, r.yearLeft * scale - (r.carriedOverLeft > 0 ? 1 : 0)),
                        12,
                        4
                      )}
                      fill={color}
                    />
                  ) : null}
                  {r.overdraft < 0 ? (
                    <Rect
                      x={zero + r.overdraft * scale}
                      y={0}
                      width={-r.overdraft * scale}
                      height={12}
                      rx={3}
                      fill={danger}
                    />
                  ) : null}
                </Svg>
              </View>
              <Text
                style={TABULAR}
                className={cn(
                  "w-[38px] text-right text-[14px] font-semibold",
                  r.remaining < 0 ? "text-danger" : "text-foreground"
                )}
              >
                {formatDays(r.remaining)}
              </Text>
            </View>
            {open ? (
              <View className="mt-2 gap-0.5 pl-[96px]">
                <TipRow label="Carried over left" value={formatDays(r.carriedOverLeft)} />
                <TipRow label={`${year} quota left`} value={formatDays(r.yearLeft)} />
                <TipRow label="Used to date" value={formatDays(r.usedToDate)} />
                {r.planned > 0 ? <TipRow label="Planned" value={formatDays(r.planned)} /> : null}
                {r.pending > 0 ? (
                  <TipRow label="Waiting for approval" value={formatDays(r.pending)} />
                ) : null}
                {onOpen ? (
                  <Pressable
                    testID={`remaining-open-${r.member.id}`}
                    accessibilityRole="link"
                    onPress={() => onOpen(r.member.id)}
                    className="mt-1 self-start py-1 active:opacity-60"
                  >
                    <Text className="text-[13px] font-semibold text-primary">
                      Open {r.member.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}
      <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
        {carries ? <Key color={color} opacity={0.38} label="Carried over" /> : null}
        <Key color={color} label={`${year} quota`} />
        {overdrawn ? <Key color={danger} label="Over the allowance" /> : null}
      </View>
    </View>
  );
}

function Key({ color, opacity = 1, label }: { color: string; opacity?: number; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, opacity }} />
      <Text className="text-[12px] text-muted-foreground">{label}</Text>
    </View>
  );
}

/** One member's days left as a thin bar, on a scale shared by the whole list. */
export function MiniRemainingBar({
  r,
  pos,
  neg,
  type,
}: {
  r: MemberRemaining;
  pos: number;
  neg: number;
  type: CalendarRecordType;
}) {
  const [width, onLayout] = useWidth();
  const color = useLeaveColor(type);
  const danger = useTone("danger");
  const scale = width / Math.max(1, pos + neg);
  const zero = neg * scale;
  const carry = r.carriedOverLeft * scale;
  const year = r.yearLeft * scale;
  return (
    <View onLayout={onLayout} className="mt-1.5 h-[6px]">
      {width > 0 ? (
        <Svg width={width} height={6}>
          <Rect x={0} y={0} width={width} height={6} rx={3} fill={color} opacity={0.1} />
          {carry > 0 ? (
            <Rect x={zero} y={0} width={carry} height={6} fill={color} opacity={0.4} />
          ) : null}
          {year > 0 ? (
            <Path d={roundedRightRect(zero + carry, 0, year, 6, 3)} fill={color} />
          ) : null}
          {r.overdraft < 0 ? (
            <Rect
              x={zero + r.overdraft * scale}
              y={0}
              width={-r.overdraft * scale}
              height={6}
              rx={3}
              fill={danger}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
