// PROTOTYPE (T-34): three ways to fit the month on a phone. Throwaway.
import { useEffect, useRef } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

import { AgendaRow, Avatar, Tint, firstName, nameFor } from "./chrome";
import {
  BG,
  BORDER,
  GROUPS,
  HOLIDAYS,
  MONTHS,
  TODAY,
  VIEWER_ID,
  WEEKDAYS,
  buildWeeks,
  dayEntries,
  formatDay,
  isoOf,
  personById,
  placeWeek,
  type LeaveType,
  type Placed,
  type Range,
  type Scope,
} from "./model";

export type GridProps = {
  year: number;
  month: number;
  ranges: Range[];
  width: number; // page width; the grid sits inside 16pt gutters
  maxLanes: number;
  selected?: string | null;
  onDay: (iso: string) => void;
  onBar: (bookingId: string) => void;
  onMore: (iso: string) => void;
};

const GUTTER = 16;

function WeekdayHeader({ cellW, compact }: { cellW: number; compact?: boolean }) {
  return (
    <View className={cn("flex-row", !compact && "border-b border-border bg-muted")}>
      {WEEKDAYS.map((w, i) => (
        <View
          key={w}
          style={{ width: cellW }}
          className={cn(compact ? "items-center py-1.5" : "px-1.5 py-2")}
        >
          <Text
            className={cn(
              "text-[11px] font-semibold uppercase",
              i >= 5 ? "text-faint" : "text-muted-foreground"
            )}
            style={{ letterSpacing: 0.4 }}
          >
            {compact ? w[0] : w}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DayNumber({
  iso,
  day,
  weekend,
  compact,
}: {
  iso: string;
  day: number;
  weekend: boolean;
  compact?: boolean;
}) {
  const today = iso === TODAY;
  return (
    <View
      className={cn(
        "h-[22px] min-w-[22px] items-center justify-center rounded-full px-1",
        today && "bg-primary"
      )}
    >
      <Text
        className={cn(
          compact ? "text-[13px]" : "text-[12px]",
          today
            ? "font-bold text-primary-foreground"
            : weekend
              ? "text-faint"
              : "font-medium text-muted-foreground"
        )}
      >
        {day}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ A: the web's lanes, ported

const BAR_H = 18;
const LANE_GAP = 2;
const BARS_TOP = 28;

function LaneBar({
  b,
  cellW,
  top,
  onBar,
}: {
  b: Placed;
  cellW: number;
  top: number;
  onBar: (id: string) => void;
}) {
  const r = b.range;
  const left = b.sc * cellW + (b.contL ? 0 : 2);
  const width = (b.ec - b.sc) * cellW - (b.contL ? 0 : 2) - (b.contR ? 0 : 2);
  const pending = r.status === "pending";
  const person = r.user ? personById(r.user) : null;
  const wide = width > 78;
  return (
    <Pressable
      onPress={() => r.bookingId && onBar(r.bookingId)}
      style={{
        position: "absolute",
        left,
        width,
        top,
        height: BAR_H,
        borderTopLeftRadius: b.contL ? 0 : 6,
        borderBottomLeftRadius: b.contL ? 0 : 6,
        borderTopRightRadius: b.contR ? 0 : 6,
        borderBottomRightRadius: b.contR ? 0 : 6,
        borderStyle: pending ? "dashed" : "solid",
      }}
      className={cn(
        "flex-row items-center gap-1 overflow-hidden pr-1",
        pending && cn("border", BORDER[r.type])
      )}
    >
      <Tint type={r.type} opacity={pending ? 0.08 : 0.2} />
      {!b.contL && !pending ? (
        <View className={cn("h-full w-[3px]", BG[r.type])} />
      ) : (
        <View className="w-[2px]" />
      )}
      {person && wide ? <Avatar person={person} size={13} /> : null}
      {!b.contL ? (
        <Text
          className="flex-1 text-[10.5px] font-semibold text-foreground"
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {nameFor(r)}
          {r.halfDay ? " ½" : ""}
        </Text>
      ) : null}
    </Pressable>
  );
}

function BankPill({ b, cellW, onPress }: { b: Placed; cellW: number; onPress: () => void }) {
  const left = b.sc * cellW + 2;
  const width = (b.ec - b.sc) * cellW - 4;
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left,
        width,
        top: BARS_TOP,
        height: BAR_H,
        borderStyle: "dashed",
      }}
      className="justify-center overflow-hidden rounded-[6px] border border-leave-bank px-1.5"
    >
      <Tint type="BANK_HOLIDAY" opacity={0.16} />
      <Text className="text-[10.5px] font-bold text-leave-bank" numberOfLines={1}>
        {b.range.names!.join(" · ")}
      </Text>
    </Pressable>
  );
}

export function LaneMonth({
  year,
  month,
  ranges,
  width,
  maxLanes,
  onDay,
  onBar,
  onMore,
}: GridProps) {
  const gridW = width - GUTTER * 2;
  const cellW = (gridW - 2) / 7;
  const rowH = BARS_TOP + maxLanes * (BAR_H + LANE_GAP) + 20;
  const weeks = buildWeeks(year, month);
  return (
    <View style={{ width, paddingHorizontal: GUTTER }}>
      <View className="overflow-hidden rounded-[16px] border border-border bg-card">
        <WeekdayHeader cellW={cellW} />
        {weeks.map((week, wi) => {
          const { bank, shown, hidden, bankRows } = placeWeek(week, ranges, maxLanes);
          return (
            <View
              key={wi}
              style={{ height: rowH }}
              className={cn("flex-row", wi < weeks.length - 1 && "border-b border-border")}
            >
              {week.map((d, di) => (
                <Pressable
                  key={di}
                  disabled={d === null}
                  onPress={() => d && onDay(isoOf(year, month, d))}
                  style={{ width: cellW }}
                  className={cn(
                    "px-1 pt-1.5 active:bg-muted",
                    di < 6 && "border-r border-border",
                    (d === null || di >= 5) && "bg-tint"
                  )}
                >
                  {d ? <DayNumber iso={isoOf(year, month, d)} day={d} weekend={di >= 5} /> : null}
                </Pressable>
              ))}
              {bank.map((b) => (
                <BankPill
                  key={b.range.id}
                  b={b}
                  cellW={cellW}
                  onPress={() => onMore(isoOf(year, month, b.range.from))}
                />
              ))}
              {shown.map((b) => (
                <LaneBar
                  key={b.range.id}
                  b={b}
                  cellW={cellW}
                  top={BARS_TOP + (bankRows + b.lane) * (BAR_H + LANE_GAP)}
                  onBar={onBar}
                />
              ))}
              {[...hidden.entries()].map(([col, list]) => (
                <Pressable
                  key={col}
                  onPress={() => onMore(isoOf(year, month, week[col]!))}
                  hitSlop={6}
                  style={{ position: "absolute", left: col * cellW + 3, bottom: 4 }}
                  className="rounded-full border border-input bg-muted px-1.5 py-[1px]"
                >
                  <Text className="text-[10.5px] font-semibold text-muted-foreground">
                    +{list.length}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ B: iOS-style compact month + day agenda

const STRIPE_H = 4;
const STRIPE_GAP = 2;

export function StripeMonth({ year, month, ranges, width, selected, onDay }: GridProps) {
  const gridW = width - GUTTER * 2;
  const cellW = gridW / 7;
  const lanes = 3;
  const rowH = 30 + lanes * (STRIPE_H + STRIPE_GAP) + 16;
  const weeks = buildWeeks(year, month);
  const holidays = new Set(HOLIDAYS.map((h) => h.date));
  const people = ranges.filter((r) => r.type !== "BANK_HOLIDAY");
  return (
    <View style={{ width, paddingHorizontal: GUTTER }}>
      <WeekdayHeader cellW={cellW} compact />
      {weeks.map((week, wi) => {
        const { shown, hidden } = placeWeek(week, people, lanes);
        return (
          <View key={wi} style={{ height: rowH }} className="flex-row border-t border-border">
            {week.map((d, di) => {
              const iso = d ? isoOf(year, month, d) : "";
              const sel = iso === selected;
              const hol = holidays.has(iso);
              return (
                <Pressable
                  key={di}
                  disabled={d === null}
                  onPress={() => d && onDay(iso)}
                  style={{ width: cellW }}
                  className="items-center pt-1"
                >
                  {hol ? (
                    <View className="absolute inset-x-[3px] top-[3px] bottom-[3px] overflow-hidden rounded-[10px]">
                      <Tint type="BANK_HOLIDAY" opacity={0.18} />
                    </View>
                  ) : null}
                  {d ? (
                    <View
                      className={cn(
                        "h-[26px] w-[26px] items-center justify-center rounded-full",
                        sel ? "bg-foreground" : iso === TODAY ? "bg-primary" : undefined
                      )}
                    >
                      <Text
                        className={cn(
                          "text-[14px]",
                          sel
                            ? "font-bold text-background"
                            : iso === TODAY
                              ? "font-bold text-primary-foreground"
                              : hol
                                ? "font-semibold text-leave-bank"
                                : di >= 5
                                  ? "text-faint"
                                  : "font-medium text-foreground"
                        )}
                      >
                        {d}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {shown.map((b) => (
              <View
                key={b.range.id}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: b.sc * cellW + (b.contL ? 0 : 5),
                  width: (b.ec - b.sc) * cellW - (b.contL ? 0 : 5) - (b.contR ? 0 : 5),
                  top: 32 + b.lane * (STRIPE_H + STRIPE_GAP),
                  height: STRIPE_H,
                  borderRadius: 2,
                  opacity: b.range.status === "pending" ? 0.4 : 1,
                }}
                className={BG[b.range.type]}
              />
            ))}
            {[...hidden.entries()].map(([col, list]) => (
              <View
                key={col}
                pointerEvents="none"
                style={{ position: "absolute", left: col * cellW, width: cellW, bottom: 2 }}
                className="items-center"
              >
                <Text className="text-[10px] font-semibold text-faint">+{list.length}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function DayAgenda({
  dayIso,
  scope,
  filter,
  onOpen,
  onBook,
}: {
  dayIso: string;
  scope: Scope;
  filter: Set<LeaveType>;
  onOpen: (id: string) => void;
  onBook: (iso: string) => void;
}) {
  const { holidays, rows } = dayEntries(dayIso, scope, filter);
  return (
    <View className="mx-4 mt-3 rounded-[24px] border border-border bg-card px-3 pt-4 pb-3">
      <View className="mb-1 flex-row items-center justify-between px-2">
        <View>
          <Text className="font-display text-[17px] font-semibold text-foreground">
            {formatDay(dayIso)}
          </Text>
          <Text className="text-[13px] text-faint">
            {rows.length === 0 ? "Nobody is away" : `${rows.length} away or remote`}
          </Text>
        </View>
        <Pressable
          onPress={() => onBook(dayIso)}
          className="rounded-full bg-primary px-4 py-2 active:opacity-90"
        >
          <Text className="text-[14px] font-semibold text-primary-foreground">Book</Text>
        </Pressable>
      </View>
      {holidays.map((h) => (
        <View
          key={h.date}
          className="mt-2 flex-row items-center gap-3 overflow-hidden rounded-[16px] px-3 py-2.5"
        >
          <Tint type="BANK_HOLIDAY" />
          <Text className="flex-1 text-[14px] font-semibold text-leave-bank">{h.name}</Text>
        </View>
      ))}
      {rows.map((r) => (
        <AgendaRow key={r.id} row={r} onPress={() => onOpen(r.bookingId)} />
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ C: people timeline

const COL_W = 34;
const NAME_W = 88;
const ROW_H = 38;

export function Timeline({
  year,
  month,
  ranges,
  scope,
  onDay,
  onBar,
  onBook,
}: {
  year: number;
  month: number;
  ranges: Range[];
  scope: Scope;
  onDay: (iso: string) => void;
  onBar: (id: string) => void;
  onBook: (iso: string) => void;
}) {
  const days = new Date(year, month, 0).getDate();
  const cols = Array.from({ length: days }, (_, i) => i + 1);
  const members =
    scope.kind === "mine"
      ? [VIEWER_ID]
      : [
          VIEWER_ID,
          ...GROUPS.find((g) => g.id === scope.groupId)!.members.filter((m) => m !== VIEWER_ID),
        ];
  const hol = new Map(
    ranges
      .filter((r) => r.type === "BANK_HOLIDAY")
      .flatMap((r) => cols.filter((d) => d >= r.from && d <= r.to).map((d) => [d, r]))
  );
  const scroller = useRef<ScrollView>(null);
  const todayDay = TODAY.startsWith(isoOf(year, month, 1).slice(0, 8))
    ? Number(TODAY.slice(8))
    : null;
  useEffect(() => {
    scroller.current?.scrollTo({
      x: todayDay ? Math.max(0, (todayDay - 3) * COL_W) : 0,
      animated: false,
    });
  }, [year, month, todayDay]);
  const weekend = (d: number) => {
    const w = new Date(year, month - 1, d).getDay();
    return w === 0 || w === 6;
  };
  return (
    <View className="mx-4 flex-row overflow-hidden rounded-[16px] border border-border bg-card">
      <View style={{ width: NAME_W }} className="border-r border-border">
        <View
          style={{ height: 44 }}
          className="justify-end border-b border-border bg-muted px-2.5 pb-1.5"
        >
          <Text
            className="text-[11px] font-semibold text-faint uppercase"
            style={{ letterSpacing: 0.4 }}
          >
            {members.length} {members.length === 1 ? "person" : "people"}
          </Text>
        </View>
        {members.map((m) => (
          <View
            key={m}
            style={{ height: ROW_H }}
            className="flex-row items-center gap-2 border-b border-border px-2"
          >
            <Avatar person={personById(m)} size={22} />
            <Text className="flex-1 text-[12.5px] font-semibold text-foreground" numberOfLines={1}>
              {m === VIEWER_ID ? "You" : firstName(personById(m).name)}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ height: 44 }} className="flex-row border-b border-border bg-muted">
            {cols.map((d) => {
              const iso = isoOf(year, month, d);
              return (
                <Pressable
                  key={d}
                  onPress={() => onDay(iso)}
                  style={{ width: COL_W }}
                  className="items-center justify-center gap-0.5"
                >
                  <Text
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      weekend(d) ? "text-faint" : "text-muted-foreground"
                    )}
                  >
                    {WEEKDAYS[(new Date(year, month - 1, d).getDay() + 6) % 7][0]}
                  </Text>
                  <View
                    className={cn(
                      "h-[20px] min-w-[20px] items-center justify-center rounded-full",
                      iso === TODAY && "bg-primary"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-[12px]",
                        iso === TODAY
                          ? "font-bold text-primary-foreground"
                          : hol.has(d)
                            ? "font-bold text-leave-bank"
                            : "font-medium text-foreground"
                      )}
                    >
                      {d}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {members.map((m) => {
            const mine = ranges.filter((r) => r.user === m);
            return (
              <View key={m} style={{ height: ROW_H }} className="flex-row border-b border-border">
                {cols.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() =>
                      m === VIEWER_ID ? onBook(isoOf(year, month, d)) : onDay(isoOf(year, month, d))
                    }
                    style={{ width: COL_W }}
                    className={cn("border-r border-border", weekend(d) && "bg-tint")}
                  >
                    {hol.has(d) ? <Tint type="BANK_HOLIDAY" opacity={0.14} /> : null}
                  </Pressable>
                ))}
                {mine.map((r) => {
                  const pending = r.status === "pending";
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => r.bookingId && onBar(r.bookingId)}
                      style={{
                        position: "absolute",
                        left: (r.from - 1) * COL_W + 2,
                        width: (r.to - r.from + 1) * COL_W - 4,
                        top: 8,
                        height: ROW_H - 16,
                        borderStyle: pending ? "dashed" : "solid",
                      }}
                      className={cn(
                        "justify-center overflow-hidden rounded-[6px] px-1.5",
                        pending ? cn("border", BORDER[r.type]) : undefined
                      )}
                    >
                      <Tint type={r.type} opacity={pending ? 0.1 : 0.85} />
                      {r.halfDay ? (
                        <Text className="text-[10px] font-bold text-foreground">½</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ------------------------------------------------------------------ month pager (A and B)

export function MonthPager({
  index,
  onIndex,
  width,
  height,
  render,
  listRef,
  extra,
}: {
  extra: unknown;
  index: number;
  onIndex: (i: number) => void;
  width: number;
  height: number;
  render: (m: { year: number; month: number }) => React.ReactElement;
  listRef: React.RefObject<FlatList<{ year: number; month: number }> | null>;
}) {
  // Only a finger decides the month; programmatic scrolls (stepper, deep link) also end in momentum events.
  const dragged = useRef(false);
  return (
    <FlatList
      ref={listRef}
      extraData={extra}
      data={MONTHS}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x: index * width, y: 0 }}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      keyExtractor={(m) => `${m.year}-${m.month}`}
      style={{ height }}
      onScrollBeginDrag={() => {
        dragged.current = true;
      }}
      onMomentumScrollEnd={(e) => {
        if (!dragged.current) return;
        dragged.current = false;
        onIndex(Math.round(e.nativeEvent.contentOffset.x / width));
      }}
      renderItem={({ item }) => render(item)}
    />
  );
}

export const laneRowHeight = (maxLanes: number) => BARS_TOP + maxLanes * (BAR_H + LANE_GAP) + 20;
export const stripeRowHeight = 30 + 3 * (STRIPE_H + STRIPE_GAP) + 16;
