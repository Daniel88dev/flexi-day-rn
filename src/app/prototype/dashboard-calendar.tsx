// PROTOTYPE (T-34): the dashboard month calendar on a phone, three variants on hardcoded fixtures.
// Open with flexiday://prototype/dashboard-calendar?variant=A&role=approver&scope=design&m=2
// Params: variant A|B|C, role employee|approver, scope mine|design|platform, m month index (0 = Aug 2026),
// lanes 2|3 (A), tap book|sheet (A), day=YYYY-MM-DD opens the day sheet. No backend, no sign-in.
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, ScrollView, useWindowDimensions, View } from "react-native";

import {
  ApprovalsWidget,
  BalanceWidget,
  DaySheet,
  FilterSheet,
  Legend,
  MonthStepper,
  OutTodayWidget,
  PageHeader,
  ScopeAndFilter,
  StatStrip,
  Switcher,
} from "@/prototype/dashboard-calendar/chrome";
import {
  MONTHS,
  TODAY,
  TYPE_ORDER,
  buildWeeks,
  isoOf,
  monthRanges,
  type LeaveType,
  type Scope,
} from "@/prototype/dashboard-calendar/model";
import {
  DayAgenda,
  LaneMonth,
  MonthPager,
  StripeMonth,
  Timeline,
  laneRowHeight,
  stripeRowHeight,
} from "@/prototype/dashboard-calendar/variants";

const VARIANTS = [
  { key: "A", name: "Lanes (web port)" },
  { key: "B", name: "Stripes + day agenda" },
  { key: "C", name: "People timeline" },
];

type Params = {
  variant?: string;
  role?: string;
  scope?: string;
  m?: string;
  lanes?: string;
  tap?: string;
  day?: string;
  sel?: string;
};

export default function DashboardCalendarPrototype() {
  const p = useLocalSearchParams<Params>();
  const { width } = useWindowDimensions();
  const variant = p.variant ?? "A";
  const approver = p.role === "approver";
  const maxLanes = p.lanes === "3" ? 3 : 2;
  const tapMode = p.tap === "book" ? "book" : "sheet";
  const scope: Scope =
    p.scope === "mine"
      ? { kind: "mine" }
      : { kind: "group", groupId: p.scope === "platform" ? "g-platform" : "g-design" };
  const index = Math.min(MONTHS.length - 1, Math.max(0, Number(p.m ?? 1)));
  const { year, month } = MONTHS[index];

  const [filter, setFilter] = useState<Set<LeaveType>>(new Set(TYPE_ORDER));
  const [filterOpen, setFilterOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<string | null>(p.day ?? null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const pager = useRef<FlatList<{ year: number; month: number }>>(null);

  const selected =
    p.sel ?? (TODAY.startsWith(isoOf(year, month, 1).slice(0, 8)) ? TODAY : isoOf(year, month, 1));

  const set = (next: Partial<Params>) => router.setParams(next);
  const setScope = (s: Scope) =>
    set({ scope: s.kind === "mine" ? "mine" : s.groupId === "g-platform" ? "platform" : "design" });
  const act = (msg: string) => setLastAction(msg);
  const openBooking = (id: string) => act(`→ /requests/[vacationId] (${id})`);
  const book = (iso: string) => {
    setSheetDay(null);
    act(`→ /requests/new?date=${iso}`);
  };
  const step = (delta: number) => {
    const i = Math.min(MONTHS.length - 1, Math.max(0, index + delta));
    set({ m: String(i), sel: undefined });
  };
  // Stepper and deep links move the pager; a swipe lands here too and is a no-op.
  useEffect(() => {
    pager.current?.scrollToIndex({ index, animated: true });
  }, [index, variant]);

  const filtered = (y: number, mo: number) =>
    monthRanges(y, mo, scope).filter((r) => filter.has(r.type));
  const ranges = filtered(year, month);
  const weeks = buildWeeks(year, month).length;

  const vIndex = VARIANTS.findIndex((v) => v.key === variant);
  const cycle = (d: number) =>
    set({ variant: VARIANTS[(vIndex + d + VARIANTS.length) % VARIANTS.length].key });

  let calendar: React.ReactElement;
  if (variant === "C") {
    calendar = (
      <Timeline
        year={year}
        month={month}
        ranges={ranges}
        scope={scope}
        onDay={(iso) => setSheetDay(iso)}
        onBar={openBooking}
        onBook={book}
      />
    );
  } else if (variant === "B") {
    calendar = (
      <View>
        <MonthPager
          listRef={pager}
          extra={[scope, filter, selected]}
          index={index}
          onIndex={(i) => i !== index && set({ m: String(i), sel: undefined })}
          width={width}
          height={28 + weeks * stripeRowHeight}
          render={(m) => (
            <StripeMonth
              year={m.year}
              month={m.month}
              ranges={filtered(m.year, m.month)}
              width={width}
              maxLanes={3}
              selected={selected}
              onDay={(iso) => set({ sel: iso })}
              onBar={openBooking}
              onMore={(iso) => set({ sel: iso })}
            />
          )}
        />
        <DayAgenda
          dayIso={selected}
          scope={scope}
          filter={filter}
          onOpen={openBooking}
          onBook={book}
        />
      </View>
    );
  } else {
    calendar = (
      <MonthPager
        listRef={pager}
        extra={[scope, filter, maxLanes, tapMode]}
        index={index}
        onIndex={(i) => i !== index && set({ m: String(i) })}
        width={width}
        height={36 + weeks * laneRowHeight(maxLanes) + 2}
        render={(m) => (
          <LaneMonth
            year={m.year}
            month={m.month}
            ranges={filtered(m.year, m.month)}
            width={width}
            maxLanes={maxLanes}
            onDay={(iso) => (tapMode === "book" ? book(iso) : setSheetDay(iso))}
            onBar={openBooking}
            onMore={(iso) => setSheetDay(iso)}
          />
        )}
      />
    );
  }

  return (
    <View className="flex-1 bg-background pt-safe">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140 }}>
        <View className="gap-5 px-4 pt-3">
          <PageHeader onPlus={() => act("→ /requests/new")} />
          <StatStrip approver={approver} scope={scope} onLink={(to) => act(`→ ${to}`)} />
          <View className="gap-3">
            <MonthStepper
              year={year}
              month={month}
              onStep={step}
              canPrev={index > 0}
              canNext={index < MONTHS.length - 1}
            />
            <ScopeAndFilter
              scope={scope}
              setScope={setScope}
              filter={filter}
              onFilter={() => setFilterOpen(true)}
            />
          </View>
        </View>
        <View className="mt-3">{calendar}</View>
        <View className="px-4">
          <Legend ranges={ranges} />
        </View>
        <View className="mt-6 gap-4 px-4">
          {approver ? <ApprovalsWidget onOpen={openBooking} /> : null}
          <OutTodayWidget scope={scope} />
          <BalanceWidget />
        </View>
      </ScrollView>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        setFilter={setFilter}
      />
      <DaySheet
        dayIso={sheetDay}
        onClose={() => setSheetDay(null)}
        scope={scope}
        filter={filter}
        onOpen={(id) => {
          setSheetDay(null);
          openBooking(id);
        }}
        onBook={book}
      />
      <Switcher
        label={`${variant} ${VARIANTS[vIndex].name}`}
        onPrev={() => cycle(-1)}
        onNext={() => cycle(1)}
        lastAction={lastAction}
        chips={[
          {
            label: approver ? "role: approver" : "role: employee",
            onPress: () => set({ role: approver ? "employee" : "approver" }),
          },
          ...(variant === "A"
            ? [
                {
                  label: `lanes: ${maxLanes}`,
                  onPress: () => set({ lanes: maxLanes === 2 ? "3" : "2" }),
                },
                {
                  label: `day tap: ${tapMode}`,
                  onPress: () => set({ tap: tapMode === "book" ? "sheet" : "book" }),
                },
              ]
            : []),
        ]}
      />
    </View>
  );
}
