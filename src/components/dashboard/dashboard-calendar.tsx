import { useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";

import { CalendarHeader } from "@/components/calendar/calendar-header";
import { DaySheet } from "@/components/calendar/day-sheet";
import { FilterSheet } from "@/components/calendar/filter-sheet";
import { LaneMonth, laneMonthHeight } from "@/components/calendar/lane-month";
import { Legend } from "@/components/calendar/legend";
import { MonthPager } from "@/components/calendar/month-pager";
import { ScopeRow } from "@/components/calendar/scope-row";
import { useMonthRanges } from "@/components/calendar/use-month-ranges";
import { LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { buildWeeks } from "@/lib/calendar/lanes";
import { dashboardScope } from "@/lib/calendar/scope";
import {
  useRequestScopeGroups,
  type CalendarRecordType,
  type RequestListScope,
} from "@/lib/local-store";
import { useMySettings } from "@/lib/query";
import {
  currentMonth,
  isoDay,
  monthOffset,
  monthsWithin,
  requestMonthBounds,
  stepMonth,
  type YearMonth,
} from "@/lib/requests/months";
import { useToday } from "@/lib/use-today";

type PageProps = {
  scope: RequestListScope;
  filter: ReadonlySet<CalendarRecordType>;
  width: number;
  viewerId: string | null;
  today: string;
  onDay: (day: string) => void;
  onBar?: (vacationId: string) => void;
};

function MonthPage({ month, scope, filter, onDay, ...props }: PageProps & { month: YearMonth }) {
  const ranges = useMonthRanges(month, scope, filter);
  return <LaneMonth month={month} ranges={ranges} onDay={onDay} onMore={onDay} {...props} />;
}

/**
 * Scope and group open on the stored default, Mine until `/me/settings` answers, and a change
 * here lasts only while the dashboard is mounted, which is the session: the tab stays mounted
 * once opened. The filter is never stored.
 */
export function DashboardCalendar({
  viewerId,
  onOpenRequest,
  onBook,
}: {
  viewerId: string | null;
  onOpenRequest?: (vacationId: string) => void;
  onBook: (day: string) => void;
}) {
  const { width } = useWindowDimensions();
  const now = useToday();
  const bounds = useMemo(() => requestMonthBounds(now), [now]);
  const months = useMemo(() => monthsWithin(bounds), [bounds]);
  const thisMonth = currentMonth(now);
  const today = isoDay(thisMonth, now.getDate());

  const [picked, setPicked] = useState<YearMonth>(thisMonth);
  const [scopeChoice, setScopeChoice] = useState<RequestListScope["kind"] | null>(null);
  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Set<CalendarRecordType>>(() => new Set(LEAVE_TYPE_ORDER));
  const [filterOpen, setFilterOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<string | null>(null);

  // The bounds move with the year, so a month picked before New Year can fall outside them.
  const index = Math.min(Math.max(monthOffset(picked, bounds), 0), months.length - 1);
  const month = months[index];

  const settings = useMySettings().data;
  const groups = useRequestScopeGroups();
  const { scope, groupId } = dashboardScope({ settings, scopeChoice, groupChoice, groups });
  const ranges = useMonthRanges(month, scope, filter);

  const step = (delta: -1 | 1) => {
    const next = stepMonth(month, delta, bounds);
    if (next) setPicked(next);
  };

  const choose = (next: RequestListScope) => {
    setScopeChoice(next.kind);
    if (next.kind === "group") setGroupChoice(next.groupId);
  };

  const openRequest =
    onOpenRequest &&
    ((vacationId: string) => {
      setSheetDay(null);
      onOpenRequest(vacationId);
    });

  return (
    <View className="gap-3">
      <View className="gap-3 px-4">
        <CalendarHeader
          month={month}
          canPrevious={stepMonth(month, -1, bounds) !== null}
          canNext={stepMonth(month, 1, bounds) !== null}
          onStep={step}
          onToday={() => setPicked(thisMonth)}
        />
        <ScopeRow
          scope={scope}
          groupId={groupId}
          groups={groups}
          filter={filter}
          onScope={choose}
          onFilter={() => setFilterOpen(true)}
        />
      </View>
      <MonthPager
        months={months}
        index={index}
        onIndex={(page) => setPicked(months[page])}
        width={width}
        height={laneMonthHeight(buildWeeks(month).length)}
        extraData={[scope, filter, viewerId, today]}
        renderMonth={(page) => (
          <MonthPage
            month={page}
            scope={scope}
            filter={filter}
            width={width}
            viewerId={viewerId}
            today={today}
            onDay={setSheetDay}
            onBar={onOpenRequest}
          />
        )}
      />
      <View className="px-4">
        <Legend ranges={ranges} />
      </View>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onChange={setFilter}
      />
      <DaySheet
        day={sheetDay}
        onClose={() => setSheetDay(null)}
        scope={scope}
        filter={filter}
        viewerId={viewerId}
        onOpen={openRequest}
        onBook={onBook}
      />
    </View>
  );
}
