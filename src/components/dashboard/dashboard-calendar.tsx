import { useEffect, useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";

import { CalendarHeader } from "@/components/calendar/calendar-header";
import { DayCard } from "@/components/calendar/day-card";
import { DayMenuContext, type DayMenuActions } from "@/components/calendar/day-menu";
import { DaySheet } from "@/components/calendar/day-sheet";
import { FilterSheet } from "@/components/calendar/filter-sheet";
import { LaneMonth, laneMonthHeight } from "@/components/calendar/lane-month";
import { Legend } from "@/components/calendar/legend";
import { MonthPager } from "@/components/calendar/month-pager";
import { ScopeRow } from "@/components/calendar/scope-row";
import { StripeMonth, stripeMonthHeight } from "@/components/calendar/stripe-month";
import { useMonthMarks } from "@/components/calendar/use-month-marks";
import { useMonthRanges } from "@/components/calendar/use-month-ranges";
import { useGroupEventActions } from "@/components/group-events/use-group-event-actions";
import { LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { openingDay } from "@/lib/calendar/day";
import { monthWeeks } from "@/lib/calendar/month-grid";
import { dashboardScope } from "@/lib/calendar/scope";
import { calendarView, type CalendarView } from "@/lib/calendar/view";
import {
  useRequestScopeGroups,
  type CalendarGroupEvent,
  type CalendarRecordType,
  type RequestListScope,
} from "@/lib/local-store";
import { dayOfDate } from "@/lib/days";
import { useMySettings } from "@/lib/query";
import {
  currentMonth,
  monthOffset,
  monthsWithin,
  requestMonthBounds,
  stepMonth,
  type YearMonth,
} from "@/lib/requests/months";
import { useScreenReaderEnabled } from "@/lib/use-screen-reader";
import { useToday } from "@/lib/use-today";

type PageProps = {
  view: CalendarView;
  selected: string;
  scope: RequestListScope;
  filter: ReadonlySet<CalendarRecordType>;
  width: number;
  viewerId: string | null;
  today: string;
  onDay: (day: string) => void;
  onBar?: (vacationId: string) => void;
};

function MonthPage({
  month,
  view,
  selected,
  scope,
  filter,
  onDay,
  onBar,
  ...props
}: PageProps & { month: YearMonth }) {
  const ranges = useMonthRanges(month, scope, filter);
  const { marks, eventSpans, dayItems } = useMonthMarks(month, scope);
  return view === "stripes" ? (
    <StripeMonth
      month={month}
      ranges={ranges}
      marks={marks}
      dayItems={dayItems}
      selected={selected}
      onDay={onDay}
      {...props}
    />
  ) : (
    <LaneMonth
      month={month}
      ranges={ranges}
      marks={marks}
      eventSpans={eventSpans}
      dayItems={dayItems}
      onDay={onDay}
      onMore={onDay}
      onBar={onBar}
      {...props}
    />
  );
}

/**
 * Scope and group open on the stored default, Mine until `/me/settings` answers, and a change
 * here lasts only while the dashboard is mounted, which is the session: the tab stays mounted
 * once opened. The filter is never stored. The view is only ever the stored one, lanes until it
 * answers; stripes shows the day list inline where lanes open it in a sheet.
 */
export function DashboardCalendar({
  viewerId,
  onOpenRequest,
  onBook,
  onYear,
  onSettings,
}: {
  viewerId: string | null;
  onOpenRequest?: (vacationId: string) => void;
  onBook: (day: string) => void;
  onYear?: (year: number) => void;
  onSettings?: () => void;
}) {
  const { width } = useWindowDimensions();
  const now = useToday();
  const bounds = useMemo(() => requestMonthBounds(now), [now]);
  const months = useMemo(() => monthsWithin(bounds), [bounds]);
  const thisMonth = currentMonth(now);
  const today = dayOfDate(now);

  const [picked, setPicked] = useState<YearMonth>(thisMonth);
  const [scopeChoice, setScopeChoice] = useState<RequestListScope["kind"] | null>(null);
  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Set<CalendarRecordType>>(() => new Set(LEAVE_TYPE_ORDER));
  const [filterOpen, setFilterOpen] = useState(false);
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<CalendarGroupEvent | null>(null);

  // The bounds move with the year, so a month picked before New Year can fall outside them.
  const index = Math.min(Math.max(monthOffset(picked, bounds), 0), months.length - 1);
  const month = months[index];

  useEffect(() => onYear?.(month.year), [onYear, month.year]);

  const settings = useMySettings().data;
  const view = calendarView(settings);
  const selectedDay = pickedDay ?? openingDay(month, today);
  const groups = useRequestScopeGroups();
  const { scope, groupId } = dashboardScope({ settings, scopeChoice, groupChoice, groups });
  const ranges = useMonthRanges(month, scope, filter);
  const groupEvents = useGroupEventActions(scope);
  const screenReader = useScreenReaderEnabled();

  // A day picked on one month does not follow the calendar to another.
  const showMonth = (next: YearMonth) => {
    setPicked(next);
    setPickedDay(null);
    setDetail(null);
  };

  const closeSheet = () => {
    setSheetDay(null);
    setDetail(null);
  };

  const pickDay = (day: string) => {
    setPickedDay(day);
    setDetail(null);
  };

  const { canCreate, create, edit, remove } = groupEvents;
  const stripes = view === "stripes";
  const dayMenu = useMemo<DayMenuActions>(
    () => ({
      canCreate,
      requestTimeOff: onBook,
      create,
      open: (event, day) => {
        if (stripes) setPickedDay(day);
        else setSheetDay(day);
        setDetail(event);
      },
      edit,
      remove,
    }),
    [canCreate, onBook, create, stripes, edit, remove, setPickedDay, setSheetDay, setDetail]
  );

  const eventHandlers = {
    onNewEvent: canCreate ? create : undefined,
    onEditEvent: edit,
    onDeleteEvent: remove,
  };

  const step = (delta: -1 | 1) => {
    const next = stepMonth(month, delta, bounds);
    if (next) showMonth(next);
  };

  const choose = (next: RequestListScope) => {
    setScopeChoice(next.kind);
    if (next.kind === "group") setGroupChoice(next.groupId);
  };

  // The sheet goes first, so the screen that opens is not left under it.
  const book = (day: string) => {
    closeSheet();
    onBook(day);
  };

  const openSettings =
    onSettings &&
    (() => {
      closeSheet();
      onSettings();
    });

  const openRequest =
    onOpenRequest &&
    ((vacationId: string) => {
      closeSheet();
      onOpenRequest(vacationId);
    });

  return (
    // The context menu's native view takes the day cells out of the accessibility tree, so a
    // screen reader gets plain cells; Book and New group event are in the day list as well.
    <DayMenuContext value={screenReader ? null : dayMenu}>
      <View className="gap-3">
        <View className="gap-3 px-4">
          <CalendarHeader
            month={month}
            canPrevious={stepMonth(month, -1, bounds) !== null}
            canNext={stepMonth(month, 1, bounds) !== null}
            onStep={step}
            onToday={() => showMonth(thisMonth)}
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
          onIndex={(page) => showMonth(months[page])}
          width={width}
          height={
            view === "stripes"
              ? stripeMonthHeight(monthWeeks(month).length)
              : laneMonthHeight(monthWeeks(month).length)
          }
          extraData={[view, selectedDay, scope, filter, viewerId, today]}
          renderMonth={(page) => (
            <MonthPage
              month={page}
              view={view}
              selected={selectedDay}
              scope={scope}
              filter={filter}
              width={width}
              viewerId={viewerId}
              today={today}
              onDay={view === "stripes" ? pickDay : setSheetDay}
              onBar={onOpenRequest}
            />
          )}
        />
        <View className="px-4">
          <Legend ranges={ranges} />
        </View>
        {view === "stripes" ? (
          <DayCard
            day={selectedDay}
            scope={scope}
            filter={filter}
            viewerId={viewerId}
            onOpen={onOpenRequest}
            onBook={onBook}
            onSettings={onSettings}
            detail={detail}
            onDetail={setDetail}
            {...eventHandlers}
          />
        ) : null}

        <FilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filter={filter}
          onChange={setFilter}
        />
        <DaySheet
          day={sheetDay}
          detail={detail}
          onDetail={setDetail}
          onClose={closeSheet}
          scope={scope}
          filter={filter}
          viewerId={viewerId}
          onOpen={openRequest}
          onBook={book}
          onSettings={openSettings}
          {...eventHandlers}
        />
        {groupEvents.editor}
      </View>
    </DayMenuContext>
  );
}
