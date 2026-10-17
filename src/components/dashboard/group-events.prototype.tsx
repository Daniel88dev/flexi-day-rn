// PROTOTYPE (T-341): three looks for group events and birthdays on the phone dashboard. The pill
// at the bottom cycles the variant, the viewer's role and the plan. Fixtures in memory only,
// nothing reaches the backend. Lives on prototype/group-events only.
//
// A  Native menu: long-press opens the iOS context menu; marks beside the day number and a
//    ribbon for multi-day events; create and edit in a page sheet; scope asked on save.
// B  Action sheet: long-press opens an ActionSheetIOS; an event band under the day numbers on
//    every week; the day sheet splits Away / Events; compact bottom sheet; scope asked first.
// C  Popover: long-press opens a day preview popover at the cell; a count badge in the corner
//    and a month agenda under the calendar; full-screen editor; scope asked first.

import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  ArrowsClockwiseIcon,
  CakeIcon,
  CalendarPlusIcon,
  ClockIcon,
  LockIcon,
  MinusIcon,
  NoteIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from "phosphor-react-native";
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Icon, useTone } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { useRequestScopeGroups } from "@/lib/local-store";
import { useViewer } from "@/lib/viewer/use-viewer";

// ---------------------------------------------------------------------------------------------
// Model

type Freq = "none" | "daily" | "weekly" | "monthly" | "yearly";
type MonthlyBy = "day" | "nth";

export type Rule = {
  freq: Freq;
  interval: number;
  weekdays: number[]; // 0 = Monday
  monthlyBy: MonthlyBy;
  until: string | null;
};

export type GroupEvent = {
  id: string;
  title: string;
  note: string;
  from: string;
  to: string;
  allDay: boolean;
  start: string; // HH:MM
  end: string;
  rule: Rule;
  skipped: string[];
  parentId: string | null; // a one-off split from a recurring group event
  createdBy: string; // "me" or a colleague's first name
};

export type Birthday = {
  name: string;
  month: number;
  day: number;
  year: number | null;
  me?: boolean;
};

type Occurrence = { event: GroupEvent; date: string };

const NO_RULE: Rule = { freq: "none", interval: 1, weekdays: [], monthlyBy: "day", until: null };
const PINK = "#e0619a";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const ORDINALS = ["1st", "2nd", "3rd", "4th", "last"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) =>
  new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const monIndex = (s: string) => (parse(s).getDay() + 6) % 7;
const daysIn = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
const nthOf = (s: string) => {
  const d = Number(s.slice(8, 10));
  const n = Math.ceil(d / 7);
  const y = Number(s.slice(0, 4));
  const m0 = Number(s.slice(5, 7)) - 1;
  return d + 7 > daysIn(y, m0) ? 4 : n - 1; // 4 = last
};
export const shortDate = (s: string) =>
  `${WEEKDAYS[monIndex(s)]} ${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
const timeLabel = (e: GroupEvent) => (e.allDay ? "All day" : `${e.start}–${e.end}`);

function ruleLabel(e: GroupEvent): string | null {
  const r = e.rule;
  if (r.freq === "none") return null;
  const every = (unit: string) =>
    r.interval === 1 ? `Every ${unit}` : `Every ${r.interval} ${unit}s`;
  let base = "";
  if (r.freq === "daily") base = every("day");
  if (r.freq === "weekly") {
    const days = [...new Set([monIndex(e.from), ...r.weekdays])].sort();
    base = `${every("week")} on ${days.length === 5 && days[4] === 4 ? "weekdays" : days.map((d) => WEEKDAYS[d]).join(", ")}`;
  }
  if (r.freq === "monthly")
    base =
      r.monthlyBy === "day"
        ? `${every("month")} on day ${Number(e.from.slice(8, 10))}`
        : `${every("month")} on the ${ORDINALS[nthOf(e.from)]} ${LONG_WEEKDAYS[monIndex(e.from)]}`;
  if (r.freq === "yearly")
    base = `${every("year")} on ${Number(e.from.slice(8, 10))} ${MONTHS[Number(e.from.slice(5, 7)) - 1]}`;
  return r.until ? `${base}, until ${shortDate(r.until)}` : base;
}

function* candidates(e: GroupEvent): Generator<string> {
  const r = e.rule;
  const start = e.from;
  const y0 = Number(start.slice(0, 4));
  const m0 = Number(start.slice(5, 7)) - 1;
  const d0 = Number(start.slice(8, 10));
  for (let k = 0; k < 2000; k++) {
    if (r.freq === "daily") yield addDays(start, k * r.interval);
    if (r.freq === "weekly") {
      const weekStart = addDays(start, -monIndex(start) + k * 7 * r.interval);
      const days = [...new Set([monIndex(start), ...r.weekdays])].sort();
      for (const wd of days) {
        const d = addDays(weekStart, wd);
        if (d >= start) yield d;
      }
    }
    if (r.freq === "monthly") {
      const total = m0 + k * r.interval;
      const y = y0 + Math.floor(total / 12);
      const m = total % 12;
      if (r.monthlyBy === "day") yield iso(new Date(y, m, Math.min(d0, daysIn(y, m))));
      else {
        const wd = monIndex(start);
        const nth = nthOf(start);
        const first = new Date(y, m, 1);
        const offset = (wd - ((first.getDay() + 6) % 7) + 7) % 7;
        let day = 1 + offset + nth * 7;
        if (nth === 4) while (day > daysIn(y, m)) day -= 7;
        if (nth === 4) while (day + 7 <= daysIn(y, m)) day += 7;
        yield iso(new Date(y, m, day));
      }
    }
    if (r.freq === "yearly") {
      const y = y0 + k * r.interval;
      yield iso(new Date(y, m0, Math.min(d0, daysIn(y, m0))));
    }
  }
}

function occurrencesOf(e: GroupEvent, from: string, to: string): string[] {
  if (e.rule.freq === "none") return e.from <= to && e.to >= from ? [e.from] : [];
  const out: string[] = [];
  for (const d of candidates(e)) {
    if (e.rule.until && d > e.rule.until) break;
    if (d > to) break;
    if (d >= from && !e.skipped.includes(d)) out.push(d);
  }
  return out;
}

export function nextDates(e: GroupEvent, count = 6): string[] {
  if (e.rule.freq === "none") return [];
  const out: string[] = [];
  for (const d of candidates(e)) {
    if (e.rule.until && d > e.rule.until) break;
    out.push(d);
    if (out.length >= count) break;
  }
  return out;
}

const covers = (e: GroupEvent, occ: string, day: string) => {
  const span = Math.round((parse(e.to).getTime() - parse(e.from).getTime()) / 86400000);
  return day >= occ && day <= addDays(occ, span);
};

// ---------------------------------------------------------------------------------------------
// Fixtures, relative to the current month

function fixtures(): { events: GroupEvent[]; birthdays: Birthday[] } {
  const now = new Date();
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const d = (n: number) => `${ym}-${pad(n)}`;
  const firstThursday = (() => {
    for (let i = 1; i <= 7; i++) if (monIndex(d(i)) === 3) return i;
    return 1;
  })();
  const base = {
    note: "",
    skipped: [],
    parentId: null,
    rule: NO_RULE,
    allDay: true,
    start: "09:00",
    end: "10:00",
  };
  return {
    events: [
      {
        ...base,
        id: "offsite",
        title: "Team offsite",
        from: d(21),
        to: d(22),
        createdBy: "Petra",
        note: "Prague office, bring laptops.",
      },
      {
        ...base,
        id: "review",
        title: "Sprint review",
        from: d(firstThursday),
        to: d(firstThursday),
        allDay: false,
        start: "14:00",
        end: "15:00",
        rule: { ...NO_RULE, freq: "weekly", interval: 2, weekdays: [3] },
        createdBy: "me",
      },
      {
        ...base,
        id: "quiz",
        title: "Pub quiz",
        from: d(23),
        to: d(23),
        allDay: false,
        start: "18:00",
        end: "21:00",
        createdBy: "Tomáš",
      },
      {
        ...base,
        id: "migration",
        title: "Server migration",
        from: d(27),
        to: d(27),
        createdBy: "me",
        note: "Read-only from 18:00.",
      },
      {
        ...base,
        id: "lunch",
        title: "Company lunch",
        from: d(1) <= d(30) ? lastFridayOf(ym) : d(30),
        to: lastFridayOf(ym),
        allDay: false,
        start: "12:00",
        end: "13:30",
        rule: { ...NO_RULE, freq: "monthly", monthlyBy: "nth" },
        createdBy: "Tomáš",
      },
    ],
    birthdays: [
      { name: "Petra", month: now.getMonth() + 1, day: 23, year: 1992 },
      { name: "Tomáš", month: now.getMonth() + 1, day: 9, year: null },
      { name: "You", month: now.getMonth() + 1, day: 28, year: 1988, me: true },
    ],
  };
}

function lastFridayOf(ym: string): string {
  const y = Number(ym.slice(0, 4));
  const m0 = Number(ym.slice(5, 7)) - 1;
  for (let day = daysIn(y, m0); day > 0; day--) {
    const s = `${ym}-${pad(day)}`;
    if (monIndex(s) === 4) return s;
  }
  return `${ym}-01`;
}

// ---------------------------------------------------------------------------------------------
// State

export type Variant = "A" | "B" | "C";
const VARIANTS: { key: Variant; name: string }[] = [
  { key: "A", name: "Native menu" },
  { key: "B", name: "Action sheet + band" },
  { key: "C", name: "Popover + agenda" },
];

type Editor =
  | { mode: "create"; date: string }
  | { mode: "edit"; eventId: string; date: string; scope: Scope | null };
type Scope = "this" | "following" | "all";
type Anchor = { date: string; x: number; y: number; w: number; h: number };

type Proto = ReturnType<typeof useProtoState>;

function useProtoState() {
  const params = useLocalSearchParams<{ variant?: string; role?: string; plan?: string }>();
  const viewer = useViewer();
  const groups = useRequestScopeGroups();
  const [variant, setVariant] = useState<Variant>(
    params.variant === "B" || params.variant === "C" ? params.variant : "A"
  );
  const [admin, setAdmin] = useState(params.role !== "member");
  const [pro, setPro] = useState(params.plan !== "free");
  const [{ events, birthdays }, setData] = useState(fixtures);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [detail, setDetail] = useState<Occurrence | null>(null);
  const [popover, setPopover] = useState<Anchor | null>(null);
  const closeDaySheet = useRef<() => void>(() => {});
  const groupName = groups[0]?.groupName ?? "Dev Team";

  const occurrences = (from: string, to: string): Occurrence[] =>
    events.flatMap((event) =>
      occurrencesOf(event, addDays(from, -7), to).map((date) => ({ event, date }))
    );

  const onDay = (day: string): Occurrence[] =>
    occurrences(day, day)
      .filter((o) => covers(o.event, o.date, day))
      .sort((a, b) =>
        a.event.allDay === b.event.allDay
          ? a.event.start.localeCompare(b.event.start)
          : a.event.allDay
            ? -1
            : 1
      );

  const birthdaysOn = (day: string): Birthday[] => {
    const m = Number(day.slice(5, 7));
    const dd = Number(day.slice(8, 10));
    return birthdays.filter((b) => b.month === m && b.day === dd);
  };

  const canEdit = (e: GroupEvent) => e.createdBy === "me" || admin;

  const replace = (fn: (list: GroupEvent[]) => GroupEvent[]) =>
    setData((d) => ({ ...d, events: fn(d.events) }));

  // Modals can't stack on iOS, so the day sheet closes before another one opens.
  const afterSheet = (fn: () => void) => {
    closeDaySheet.current();
    setPopover(null);
    setTimeout(fn, 700);
  };

  const save = (draft: GroupEvent, ed: Editor, scope: Scope | null) => {
    if (ed.mode === "create") {
      replace((list) => [...list, { ...draft, id: `e${Date.now()}`, createdBy: "me" }]);
      return;
    }
    const original = events.find((e) => e.id === ed.eventId);
    if (!original) return;
    if (original.rule.freq === "none" || scope === "all" || scope === null) {
      replace((list) =>
        list.map((e) => (e.id === original.id ? { ...draft, id: original.id } : e))
      );
    } else if (scope === "this") {
      replace((list) => [
        ...list.map((e) => (e.id === original.id ? { ...e, skipped: [...e.skipped, ed.date] } : e)),
        {
          ...draft,
          id: `e${Date.now()}`,
          rule: NO_RULE,
          parentId: original.id,
          createdBy: original.createdBy,
        },
      ]);
    } else {
      replace((list) => [
        ...list.map((e) =>
          e.id === original.id ? { ...e, rule: { ...e.rule, until: addDays(ed.date, -1) } } : e
        ),
        {
          ...draft,
          id: `e${Date.now()}`,
          from: ed.date,
          to: ed.date,
          createdBy: original.createdBy,
        },
      ]);
    }
  };

  const remove = (o: Occurrence, scope: Scope | null) => {
    const e = o.event;
    if (e.rule.freq === "none" || scope === "all" || scope === null)
      replace((list) => list.filter((x) => x.id !== e.id && x.parentId !== e.id));
    else if (scope === "this")
      replace((list) =>
        list.map((x) => (x.id === e.id ? { ...x, skipped: [...x.skipped, o.date] } : x))
      );
    else
      replace((list) =>
        list.map((x) =>
          x.id === e.id ? { ...x, rule: { ...x.rule, until: addDays(o.date, -1) } } : x
        )
      );
  };

  const askDelete = (o: Occurrence) => {
    if (o.event.rule.freq === "none") {
      Alert.alert(
        `Delete “${o.event.title}”?`,
        "It leaves every calendar, ICS feeds and synced Google or Microsoft calendars included. There is no undo.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => remove(o, null) },
        ]
      );
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Delete “${o.event.title}”`,
        message:
          "This is a recurring group event. It leaves every calendar, synced ones included. No undo.",
        options: ["This event", "This and following", "All events", "Cancel"],
        destructiveButtonIndex: [0, 1, 2],
        cancelButtonIndex: 3,
      },
      (i) => {
        if (i < 3) remove(o, (["this", "following", "all"] as const)[i]);
      }
    );
  };

  // B and C ask the scope before the form opens; A asks it on save.
  const startEdit = (o: Occurrence) => {
    const open = (scope: Scope | null) =>
      setEditor({ mode: "edit", eventId: o.event.id, date: o.date, scope });
    if (variant === "A" || o.event.rule.freq === "none") return afterSheet(() => open(null));
    afterSheet(() =>
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Edit “${o.event.title}”`,
          message: shortDate(o.date),
          options: ["This event", "This and following", "All events", "Cancel"],
          cancelButtonIndex: 3,
        },
        (i) => {
          if (i < 3) open((["this", "following", "all"] as const)[i]);
        }
      )
    );
  };

  const startCreate = (date: string) => afterSheet(() => setEditor({ mode: "create", date }));
  const openDetail = (o: Occurrence) => afterSheet(() => setDetail(o));
  const requestTimeOff = (date: string) => {
    setPopover(null);
    router.push({ pathname: "/requests/new", params: { date } });
  };

  return {
    variant,
    setVariant,
    admin,
    setAdmin,
    pro,
    setPro,
    events,
    viewerName: viewer?.name?.split(" ")[0] ?? "You",
    groupName,
    occurrences,
    onDay,
    birthdaysOn,
    canEdit,
    save,
    askDelete,
    startEdit,
    startCreate,
    openDetail,
    requestTimeOff,
    editor,
    setEditor,
    detail,
    setDetail,
    popover,
    setPopover,
    closeDaySheet,
  };
}

const Ctx = createContext<Proto | null>(null);

export function GroupEventsProto({ children }: { children: ReactNode }) {
  const state = useProtoState();
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useGroupEventsProto(): Proto {
  const p = useContext(Ctx);
  if (!p) throw new Error("GroupEventsProto missing");
  return p;
}

/** Extra row height variant B's event band takes in the lanes. */
export const BAND_H = 17;

function birthdayLabel(b: Birthday, day: string) {
  const age = b.year ? Number(day.slice(0, 4)) - b.year : null;
  if (b.me) return age ? `Your birthday · ${age}` : "Your birthday";
  return age ? `${b.name} turns ${age}` : `${b.name}'s birthday`;
}

// ---------------------------------------------------------------------------------------------
// Long-press on a day

export function ProtoDayPress({
  date,
  testID,
  onPress,
  style,
  className,
  accessibilityLabel,
  children,
}: {
  date: string;
  testID: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  className?: string;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const p = useGroupEventsProto();
  const ref = useRef<View>(null);
  const occ = p.onDay(date);
  const bdays = p.birthdaysOn(date);

  const pressable = (onLongPress?: () => void) => (
    <Pressable
      ref={ref}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={[{ name: "longpress", label: "Day actions" }]}
      onAccessibilityAction={() => onLongPress?.()}
      style={style}
      className={className}
    >
      {children}
    </Pressable>
  );

  if (p.variant === "A") {
    return (
      <Link
        href={{ pathname: "/requests/new", params: { date } }}
        asChild
        onPress={(e) => {
          e.preventDefault();
          onPress();
        }}
      >
        <Link.Trigger>{pressable()}</Link.Trigger>
        <Link.Menu title={shortDate(date)}>
          <Link.MenuAction
            title="Request time off"
            icon="calendar.badge.plus"
            onPress={() => p.requestTimeOff(date)}
          />
          {p.pro ? (
            <Link.MenuAction
              title="New group event"
              icon="star"
              onPress={() => p.startCreate(date)}
            />
          ) : null}
          {occ.map((o) =>
            p.canEdit(o.event) ? (
              <Link.Menu
                key={o.event.id}
                title={o.event.title}
                subtitle={timeLabel(o.event)}
                icon="circle.fill"
              >
                <Link.MenuAction title="Open" icon="info.circle" onPress={() => p.openDetail(o)} />
                <Link.MenuAction title="Edit…" icon="pencil" onPress={() => p.startEdit(o)} />
                <Link.MenuAction
                  title="Delete…"
                  icon="trash"
                  destructive
                  onPress={() => p.askDelete(o)}
                />
              </Link.Menu>
            ) : (
              <Link.Menu
                key={o.event.id}
                title={o.event.title}
                subtitle={timeLabel(o.event)}
                icon="circle.fill"
              >
                <Link.MenuAction title="Open" icon="info.circle" onPress={() => p.openDetail(o)} />
                <Link.MenuAction
                  title="Edit or delete"
                  subtitle={`Only ${o.event.createdBy} or a group admin can change this`}
                  icon="lock"
                  disabled
                />
              </Link.Menu>
            )
          )}
          {bdays.map((b) => (
            <Link.MenuAction
              key={b.name}
              title={birthdayLabel(b, date)}
              icon="birthday.cake"
              disabled
            />
          ))}
        </Link.Menu>
      </Link>
    );
  }

  if (p.variant === "B") {
    return pressable(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const options = [
        "Request time off",
        ...(p.pro ? ["New group event"] : []),
        ...occ.map((o) => `${o.event.title} · ${timeLabel(o.event)}`),
        "Cancel",
      ];
      const lines = bdays.map((b) => `🎂 ${birthdayLabel(b, date)}`);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: shortDate(date),
          message: lines.length ? lines.join("\n") : undefined,
          options,
          cancelButtonIndex: options.length - 1,
        },
        (i) => {
          const offset = p.pro ? 2 : 1;
          if (i === 0) return p.requestTimeOff(date);
          if (p.pro && i === 1) return p.startCreate(date);
          const o = occ[i - offset];
          if (!o) return;
          const editable = p.canEdit(o.event);
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: o.event.title,
              message: editable
                ? [shortDate(o.date), timeLabel(o.event), ruleLabel(o.event)]
                    .filter(Boolean)
                    .join(" · ")
                : `Only ${o.event.createdBy} or a group admin can change this`,
              options: editable ? ["Open", "Edit…", "Delete…", "Cancel"] : ["Open", "Cancel"],
              destructiveButtonIndex: editable ? 2 : undefined,
              cancelButtonIndex: editable ? 3 : 1,
            },
            (j) => {
              if (j === 0) p.openDetail(o);
              if (editable && j === 1) p.startEdit(o);
              if (editable && j === 2) p.askDelete(o);
            }
          );
        }
      );
    });
  }

  return pressable(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ref.current?.measureInWindow((x, y, w, h) => p.setPopover({ date, x, y, w, h }));
  });
}

// ---------------------------------------------------------------------------------------------
// Marks in the month views

function useInk() {
  return useTone("foreground");
}

/** Lanes: right of the day number in the cell's header row. */
export function LaneDayMark({ date }: { date: string }) {
  const p = useGroupEventsProto();
  const ink = useInk();
  const occ = p.onDay(date);
  const bdays = p.birthdaysOn(date);
  if (!occ.length && !bdays.length) return null;
  if (p.variant === "A")
    return (
      <View className="ml-auto flex-row items-center gap-[2px] pr-[1px]">
        {bdays.length ? <CakeIcon size={11} color={PINK} weight="fill" /> : null}
        {occ.length ? (
          <View className="flex-row items-center gap-[1px]">
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink }} />
            {occ.length > 1 ? (
              <Text className="text-[9px] font-bold text-foreground">{occ.length}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  if (p.variant === "C") return <CornerBadge count={occ.length} birthday={bdays.length > 0} />;
  return null;
}

function CornerBadge({ count, birthday }: { count: number; birthday: boolean }) {
  const ink = useInk();
  const card = useTone("card");
  return (
    <View
      style={{ position: "absolute", top: 3, right: 3 }}
      className="flex-row items-center gap-[2px]"
    >
      {birthday ? <CakeIcon size={11} color={PINK} weight="fill" /> : null}
      {count ? (
        <View
          style={{
            minWidth: 15,
            height: 15,
            borderRadius: 8,
            backgroundColor: ink,
            paddingHorizontal: 3,
          }}
          className="items-center justify-center"
        >
          <Text style={{ color: card, fontSize: 9.5, fontWeight: "800" }}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

type Cell = { date: string };

function multiDaySpans(p: Proto, week: readonly Cell[]) {
  const from = week[0].date;
  const to = week[6].date;
  return p
    .occurrences(from, to)
    .filter((o) => o.event.from !== o.event.to)
    .map((o) => {
      const cols = week
        .map((c, i) => (covers(o.event, o.date, c.date) ? i : -1))
        .filter((i) => i >= 0);
      return cols.length ? { o, start: cols[0], end: cols[cols.length - 1] + 1 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/** Lanes: drawn over a week row after the bars. A draws ribbons, B the event band. */
export function LaneWeekOverlay({
  week,
  cellWidth,
  top,
}: {
  week: readonly Cell[];
  cellWidth: number;
  top: number;
}) {
  const p = useGroupEventsProto();
  const ink = useInk();
  if (p.variant === "A")
    return (
      <>
        {multiDaySpans(p, week).map(({ o, start, end }) => (
          <View
            key={o.event.id + o.date}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: start * cellWidth + 1,
              width: (end - start) * cellWidth - 2,
              height: 3,
              borderRadius: 2,
              backgroundColor: ink,
            }}
          />
        ))}
      </>
    );
  if (p.variant !== "B") return null;

  // One band row: multi-day first, then the first single-day event per free day, a cake chip
  // for a birthday on a day the band left free, and "+N" where more did not fit.
  const used = new Set<number>();
  const pieces: ReactNode[] = [];
  for (const { o, start, end } of multiDaySpans(p, week)) {
    if ([...Array(end - start)].some((_, k) => used.has(start + k))) continue;
    for (let k = start; k < end; k++) used.add(k);
    pieces.push(
      <BandBar
        key={o.event.id + o.date}
        o={o}
        left={start * cellWidth}
        width={(end - start) * cellWidth}
        top={top}
      />
    );
  }
  week.forEach((c, col) => {
    const singles = p.onDay(c.date).filter((o) => o.event.from === o.event.to);
    const bdays = p.birthdaysOn(c.date);
    const items = singles.length + bdays.length;
    if (!items || used.has(col)) return;
    used.add(col);
    if (singles[0])
      pieces.push(
        <BandBar
          key={singles[0].event.id + c.date}
          o={singles[0]}
          left={col * cellWidth}
          width={cellWidth}
          top={top}
          more={items - 1}
          cake={bdays.length > 0}
        />
      );
    else
      pieces.push(
        <View
          key={`b${c.date}`}
          pointerEvents="none"
          style={{
            position: "absolute",
            top,
            left: col * cellWidth + 2,
            width: cellWidth - 4,
            height: BAND_H - 3,
          }}
          className="flex-row items-center gap-[2px] overflow-hidden rounded-[5px] px-1"
        >
          <View className="absolute inset-0" style={{ backgroundColor: PINK, opacity: 0.16 }} />
          <CakeIcon size={10} color={PINK} weight="fill" />
          <Text style={{ color: PINK }} className="text-[9.5px] font-bold" numberOfLines={1}>
            {bdays[0].me ? "You" : bdays[0].name}
          </Text>
        </View>
      );
  });
  return <>{pieces}</>;
}

function BandBar({
  o,
  left,
  width,
  top,
  more = 0,
  cake = false,
}: {
  o: Occurrence;
  left: number;
  width: number;
  top: number;
  more?: number;
  cake?: boolean;
}) {
  const ink = useInk();
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top, left: left + 2, width: width - 4, height: BAND_H - 3 }}
      className="flex-row items-center gap-[2px] overflow-hidden rounded-[5px] pr-0.5"
    >
      <View className="absolute inset-0" style={{ backgroundColor: ink, opacity: 0.1 }} />
      <View style={{ width: 2.5, height: "100%", backgroundColor: ink }} />
      {cake ? <CakeIcon size={9} color={PINK} weight="fill" /> : null}
      <Text
        className="flex-1 text-[9.5px] font-bold text-foreground"
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {o.event.title}
      </Text>
      {more ? <Text className="text-[8.5px] font-bold text-muted-foreground">+{more}</Text> : null}
    </View>
  );
}

/** Stripes: marks in the day cell. */
export function StripeDayMark({ date }: { date: string }) {
  const p = useGroupEventsProto();
  const ink = useInk();
  const occ = p.onDay(date);
  const bdays = p.birthdaysOn(date);
  if (!occ.length && !bdays.length) return null;
  if (p.variant === "C") return <CornerBadge count={occ.length} birthday={bdays.length > 0} />;
  if (p.variant === "B")
    return bdays.length ? (
      <View pointerEvents="none" style={{ position: "absolute", top: 2, right: 4 }}>
        <CakeIcon size={10} color={PINK} weight="fill" />
      </View>
    ) : null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 2, right: 3 }}
      className="flex-row items-center gap-[2px]"
    >
      {bdays.length ? <CakeIcon size={10} color={PINK} weight="fill" /> : null}
      {occ.slice(0, 3).map((o) => (
        <View
          key={o.event.id}
          style={{ width: 4.5, height: 4.5, borderRadius: 3, backgroundColor: ink }}
        />
      ))}
    </View>
  );
}

/** Stripes: B draws an ink stripe above the leave stripes for every event. */
export function StripeWeekOverlay({
  week,
  cellWidth,
  top,
}: {
  week: readonly Cell[];
  cellWidth: number;
  top: number;
}) {
  const p = useGroupEventsProto();
  const ink = useInk();
  if (p.variant !== "B") return null;
  return (
    <>
      {week.map((c, col) =>
        p.onDay(c.date).length ? (
          <View
            key={c.date}
            pointerEvents="none"
            style={{
              position: "absolute",
              top,
              left:
                col * cellWidth +
                (p.onDay(addDays(c.date, -1)).some((o) => o.event.from !== o.event.to) && col > 0
                  ? 0
                  : 5),
              width: cellWidth - 5,
              height: 3,
              borderRadius: 2,
              backgroundColor: ink,
            }}
          />
        ) : null
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// The day sheet and day card

function EventCard({ o, compact = false }: { o: Occurrence; compact?: boolean }) {
  const p = useGroupEventsProto();
  const e = o.event;
  const editable = p.canEdit(e);
  const meta = [timeLabel(e), ruleLabel(e)].filter(Boolean).join(" · ");
  return (
    <Pressable
      testID={`proto-event-${e.id}-${o.date}`}
      onPress={() => p.openDetail(o)}
      className="mb-1.5 flex-row gap-3 rounded-[16px] border border-border px-3 py-2.5 active:bg-muted"
    >
      <View className="mt-1 h-2.5 w-2.5 rounded-full bg-foreground" />
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {e.title}
        </Text>
        <Text className="text-[12.5px] text-muted-foreground" numberOfLines={2}>
          {e.from !== e.to ? `${shortDate(e.from)} – ${shortDate(e.to)} · ` : ""}
          {meta}
        </Text>
        {!compact && e.note ? (
          <Text className="text-[12.5px] text-faint" numberOfLines={2}>
            {e.note}
          </Text>
        ) : null}
        <Text className="text-[11.5px] text-faint">
          Added by {e.createdBy === "me" ? "you" : e.createdBy} · {p.groupName}
        </Text>
        {!compact ? (
          editable ? (
            <View className="mt-1.5 flex-row gap-2">
              <Pressable
                testID={`proto-event-edit-${e.id}`}
                onPress={() => p.startEdit(o)}
                className="flex-row items-center gap-1 rounded-full border border-input px-3 py-1 active:bg-muted"
              >
                <Icon icon={PencilSimpleIcon} tone="foreground" size={13} />
                <Text className="text-[12.5px] font-semibold text-foreground">Edit</Text>
              </Pressable>
              <Pressable
                testID={`proto-event-delete-${e.id}`}
                onPress={() => p.askDelete(o)}
                className="flex-row items-center gap-1 rounded-full border border-input px-3 py-1 active:bg-muted"
              >
                <Icon icon={TrashIcon} tone="danger" size={13} />
                <Text className="text-[12.5px] font-semibold text-danger">Delete</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-1 flex-row items-center gap-1">
              <Icon icon={LockIcon} tone="faint" size={12} />
              <Text className="text-[11.5px] text-faint">
                Only {e.createdBy} or a group admin can change this
              </Text>
            </View>
          )
        ) : null}
      </View>
    </Pressable>
  );
}

function BirthdayRow({ b, day }: { b: Birthday; day: string }) {
  return (
    <View className="mb-1.5 flex-row items-center gap-3 overflow-hidden rounded-[16px] px-3 py-2.5">
      <View className="absolute inset-0" style={{ backgroundColor: PINK, opacity: 0.12 }} />
      <CakeIcon size={18} color={PINK} weight="fill" />
      <Text className="flex-1 text-[15px] font-semibold" style={{ color: PINK }}>
        {birthdayLabel(b, day)}
      </Text>
      {b.me ? <Text className="text-[12px] text-faint">Settings ›</Text> : null}
    </View>
  );
}

/** Inside the day list, above the people away. */
export function ProtoDayEvents({ day, tab }: { day: string; tab: "away" | "events" }) {
  const p = useGroupEventsProto();
  const occ = p.onDay(day);
  const bdays = p.birthdaysOn(day);
  if (p.variant === "B" && tab === "away") return null;
  if (!occ.length && !bdays.length)
    return p.variant === "B" ? (
      <Text className="px-2 py-4 text-[14px] text-faint">No group events or birthdays.</Text>
    ) : null;
  return (
    <View className="mb-1">
      {p.variant !== "B" ? (
        <Text className="px-2 pt-1 pb-1.5 text-[11px] font-bold tracking-[1px] text-faint uppercase">
          Group events
        </Text>
      ) : null}
      {occ.map((o) => (
        <EventCard key={o.event.id + o.date} o={o} compact={p.variant === "C"} />
      ))}
      {bdays.map((b) => (
        <BirthdayRow key={b.name} b={b} day={day} />
      ))}
      {p.variant !== "B" ? (
        <Text className="px-2 pt-2 pb-1 text-[11px] font-bold tracking-[1px] text-faint uppercase">
          Away
        </Text>
      ) : null}
    </View>
  );
}

/** B only: the Away / Events switch at the top of the day list. */
export function ProtoDayTabs({
  day,
  tab,
  onTab,
  away,
}: {
  day: string;
  tab: "away" | "events";
  onTab: (t: "away" | "events") => void;
  away: number;
}) {
  const p = useGroupEventsProto();
  if (p.variant !== "B") return null;
  const count = p.onDay(day).length + p.birthdaysOn(day).length;
  return (
    <View className="mx-5 mb-2 flex-row rounded-full bg-muted p-[3px]">
      {(["away", "events"] as const).map((k) => (
        <Pressable
          key={k}
          testID={`proto-day-tab-${k}`}
          onPress={() => onTab(k)}
          className={cn("flex-1 items-center rounded-full py-1.5", tab === k && "bg-card")}
        >
          <Text
            className={cn(
              "text-[13px] font-semibold",
              tab === k ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {k === "away" ? `Away · ${away}` : `Events · ${count}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Next to "Book" at the foot of the day list. */
export function ProtoNewEventButton({ day }: { day: string }) {
  const p = useGroupEventsProto();
  if (!p.pro) return null;
  return (
    <Pressable
      testID="proto-day-new-event"
      onPress={() => p.startCreate(day)}
      className="mt-2 h-11 flex-row items-center justify-center gap-2 rounded-full border border-input active:bg-muted"
    >
      <Icon icon={CalendarPlusIcon} tone="foreground" size={16} />
      <Text className="text-[15px] font-semibold text-foreground">New group event</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
// C: month agenda under the calendar

export function ProtoAgenda({ monthStart }: { monthStart: string }) {
  const p = useGroupEventsProto();
  if (p.variant !== "C") return null;
  const y = Number(monthStart.slice(0, 4));
  const m0 = Number(monthStart.slice(5, 7)) - 1;
  const end = `${monthStart.slice(0, 7)}-${pad(daysIn(y, m0))}`;
  const occ = p
    .occurrences(monthStart, end)
    .filter((o) => o.date >= monthStart || covers(o.event, o.date, monthStart));
  const bdays: { date: string; b: Birthday }[] = [];
  for (let d = 1; d <= daysIn(y, m0); d++) {
    const s = `${monthStart.slice(0, 7)}-${pad(d)}`;
    p.birthdaysOn(s).forEach((b) => bdays.push({ date: s, b }));
  }
  const rows = [
    ...occ.map((o) => ({
      date: o.date < monthStart ? monthStart : o.date,
      o,
      b: null as Birthday | null,
    })),
    ...bdays.map(({ date, b }) => ({ date, o: null as Occurrence | null, b })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <View
      testID="proto-agenda"
      className="mx-4 rounded-[24px] border border-border bg-card px-3 pt-3.5 pb-2"
    >
      <View className="flex-row items-center justify-between px-2 pb-2">
        <Text className="font-display text-[17px] font-semibold text-foreground">
          This month in {p.groupName}
        </Text>
        {p.pro ? (
          <Pressable
            testID="proto-agenda-new"
            onPress={() => p.startCreate(iso(new Date()))}
            className="flex-row items-center gap-1 rounded-full bg-muted px-3 py-1.5"
          >
            <Icon icon={PlusIcon} tone="foreground" size={13} weight="bold" />
            <Text className="text-[13px] font-semibold text-foreground">New</Text>
          </Pressable>
        ) : null}
      </View>
      {rows.length === 0 ? (
        <Text className="px-2 pb-3 text-[14px] text-faint">Nothing this month.</Text>
      ) : null}
      {rows.map((r) => (
        <Pressable
          key={(r.o ? r.o.event.id : r.b!.name) + r.date}
          onPress={r.o ? () => p.openDetail(r.o!) : undefined}
          className="flex-row items-center gap-3 rounded-[16px] px-2 py-2 active:bg-muted"
        >
          <View className="w-11 items-center">
            <Text className="text-[10.5px] font-bold text-faint uppercase">
              {WEEKDAYS[monIndex(r.date)]}
            </Text>
            <Text className="text-[17px] font-semibold text-foreground">
              {Number(r.date.slice(8, 10))}
            </Text>
          </View>
          {r.o ? (
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                {r.o.event.title}
              </Text>
              <Text className="text-[12.5px] text-muted-foreground" numberOfLines={1}>
                {[timeLabel(r.o.event), ruleLabel(r.o.event)].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ) : (
            <View className="flex-1 flex-row items-center gap-1.5">
              <CakeIcon size={15} color={PINK} weight="fill" />
              <Text className="text-[15px] font-semibold" style={{ color: PINK }}>
                {birthdayLabel(r.b!, r.date)}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Layer: popover, detail sheet, editor, pill

export function ProtoLayer() {
  return (
    <>
      <Popover />
      <DetailSheet />
      <EditorHost />
      <Pill />
    </>
  );
}

function Popover() {
  const p = useGroupEventsProto();
  const a = p.popover;
  if (!a) return null;
  const occ = p.onDay(a.date);
  const bdays = p.birthdaysOn(a.date);
  const width = 270;
  const left = Math.min(Math.max(a.x + a.w / 2 - width / 2, 12), 402 - width - 12);
  const below = a.y < 420;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => p.setPopover(null)}>
      <Pressable
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
        onPress={() => p.setPopover(null)}
      />
      <View
        style={{
          position: "absolute",
          left: a.x - 2,
          top: a.y - 2,
          width: a.w + 4,
          height: a.h + 4,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: "white",
        }}
        pointerEvents="none"
      />
      <View
        testID="proto-popover"
        style={{
          position: "absolute",
          left,
          width,
          ...(below ? { top: a.y + a.h + 8 } : { bottom: 852 - a.y + 8 }),
        }}
        className="overflow-hidden rounded-[20px] bg-card shadow-lg elevation-lg"
      >
        <View className="gap-1 px-4 pt-3.5 pb-2">
          <Text className="font-display text-[17px] font-semibold text-foreground">
            {shortDate(a.date)}
          </Text>
          {occ.map((o) => (
            <Pressable
              key={o.event.id}
              onPress={() => p.openDetail(o)}
              className="flex-row items-center gap-2 py-1"
            >
              <View className="h-2 w-2 rounded-full bg-foreground" />
              <Text className="flex-1 text-[14px] font-semibold text-foreground" numberOfLines={1}>
                {o.event.title}
              </Text>
              <Text className="text-[12px] text-faint">{timeLabel(o.event)}</Text>
            </Pressable>
          ))}
          {bdays.map((b) => (
            <View key={b.name} className="flex-row items-center gap-2 py-1">
              <CakeIcon size={13} color={PINK} weight="fill" />
              <Text className="text-[14px] font-semibold" style={{ color: PINK }}>
                {birthdayLabel(b, a.date)}
              </Text>
            </View>
          ))}
          {!occ.length && !bdays.length ? (
            <Text className="text-[13px] text-faint">Nothing planned</Text>
          ) : null}
        </View>
        <View className="h-px bg-border" />
        <MenuRow
          label="Request time off"
          icon={CalendarPlusIcon}
          onPress={() => p.setPopover(null)}
        />
        {p.pro ? (
          <MenuRow label="New group event" icon={PlusIcon} onPress={() => p.startCreate(a.date)} />
        ) : null}
      </View>
    </Modal>
  );
}

function MenuRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: typeof PlusIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-3 active:bg-muted"
    >
      <Text className="text-[15px] text-foreground">{label}</Text>
      <Icon icon={icon} tone="foreground" size={17} />
    </Pressable>
  );
}

function DetailSheet() {
  const p = useGroupEventsProto();
  const o = p.detail;
  return (
    <Modal
      visible={o !== null}
      transparent
      animationType="slide"
      onRequestClose={() => p.setDetail(null)}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.38)" }}
          onPress={() => p.setDetail(null)}
        />
        {o ? (
          <View testID="proto-detail" className="rounded-t-[28px] bg-card px-4 pt-2.5 pb-safe">
            <View className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
            <Text className="font-display px-1 pb-2 text-[20px] font-semibold text-foreground">
              {o.event.title}
            </Text>
            <DetailLine
              icon={CalendarPlusIcon}
              text={
                o.event.from !== o.event.to
                  ? `${shortDate(o.event.from)} – ${shortDate(o.event.to)}`
                  : shortDate(o.date)
              }
            />
            <DetailLine icon={ClockIcon} text={timeLabel(o.event)} />
            {ruleLabel(o.event) ? (
              <DetailLine icon={ArrowsClockwiseIcon} text={ruleLabel(o.event)!} />
            ) : null}
            {o.event.note ? <DetailLine icon={NoteIcon} text={o.event.note} /> : null}
            <DetailLine
              icon={UsersIcon}
              text={`${p.groupName} · added by ${o.event.createdBy === "me" ? "you" : o.event.createdBy}`}
            />
            {p.canEdit(o.event) ? (
              <View className="flex-row gap-2 pt-3 pb-2">
                <Pressable
                  testID="proto-detail-edit"
                  onPress={() => {
                    p.setDetail(null);
                    setTimeout(() => p.startEdit(o), 600);
                  }}
                  className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary"
                >
                  <Icon icon={PencilSimpleIcon} tone="onPrimary" size={16} />
                  <Text className="text-[15px] font-semibold text-primary-foreground">Edit</Text>
                </Pressable>
                <Pressable
                  testID="proto-detail-delete"
                  onPress={() => {
                    p.setDetail(null);
                    setTimeout(() => p.askDelete(o), 600);
                  }}
                  className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border border-input"
                >
                  <Icon icon={TrashIcon} tone="danger" size={16} />
                  <Text className="text-[15px] font-semibold text-danger">Delete</Text>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5 px-1 pt-3 pb-3">
                <Icon icon={LockIcon} tone="faint" size={14} />
                <Text className="text-[13px] text-faint">
                  Only {o.event.createdBy} or a group admin can change this
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DetailLine({ icon, text }: { icon: typeof PlusIcon; text: string }) {
  return (
    <View className="flex-row items-start gap-3 px-1 py-1.5">
      <Icon icon={icon} tone="muted" size={18} />
      <Text className="flex-1 text-[15px] text-foreground">{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Editor

function blank(date: string): GroupEvent {
  return {
    id: "draft",
    title: "",
    note: "",
    from: date,
    to: date,
    allDay: true,
    start: "09:00",
    end: "10:00",
    rule: NO_RULE,
    skipped: [],
    parentId: null,
    createdBy: "me",
  };
}

function EditorHost() {
  const p = useGroupEventsProto();
  const ed = p.editor;
  if (!ed) return null;
  const original = ed.mode === "edit" ? p.events.find((e) => e.id === ed.eventId) : null;
  const initial: GroupEvent = original
    ? { ...original, from: ed.date, to: original.from === original.to ? ed.date : original.to }
    : blank(ed.date);
  return <Editor key={JSON.stringify(ed)} ed={ed} initial={initial} original={original ?? null} />;
}

function Editor({
  ed,
  initial,
  original,
}: {
  ed: Editor;
  initial: GroupEvent;
  original: GroupEvent | null;
}) {
  const p = useGroupEventsProto();
  const [d, setD] = useState<GroupEvent>(initial);
  const [moreOpen, setMoreOpen] = useState(false);
  const set = (patch: Partial<GroupEvent>) => setD((x) => ({ ...x, ...patch }));
  const setRule = (patch: Partial<Rule>) => setD((x) => ({ ...x, rule: { ...x.rule, ...patch } }));
  const scope = ed.mode === "edit" ? ed.scope : null;
  const recurring = original && original.rule.freq !== "none";
  const ruleLocked = scope === "this";
  const multiDay = d.to > d.from;
  const close = () => p.setEditor(null);
  const title = ed.mode === "create" ? "New group event" : "Edit group event";

  const submit = () => {
    if (!d.title.trim()) return Alert.alert("Add a title");
    if (!d.allDay && d.from === d.to && d.end <= d.start)
      return Alert.alert("The end must be after the start");
    if (p.variant === "A" && recurring && ed.mode === "edit") {
      const ruleChanged = JSON.stringify(d.rule) !== JSON.stringify(original!.rule);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Save changes to a recurring group event",
          message: ruleChanged ? "A new repeat rule can't apply to one date." : undefined,
          options: ["This event", "This and following", "All events", "Cancel"],
          disabledButtonIndices: ruleChanged ? [0] : undefined,
          cancelButtonIndex: 3,
        },
        (i) => {
          if (i > 2) return;
          p.save(d, ed, (["this", "following", "all"] as const)[i]);
          close();
        }
      );
      return;
    }
    p.save(d, ed, scope);
    close();
  };

  const scopeNote =
    scope === "this"
      ? `Only ${shortDate(ed.mode === "edit" ? ed.date : d.from)}. The repeat rule stays as it is.`
      : scope === "following"
        ? `From ${shortDate(ed.mode === "edit" ? ed.date : d.from)} on. Earlier dates keep the old details.`
        : scope === "all"
          ? "Every date, past ones included."
          : null;

  const fields = (
    <>
      {scopeNote ? (
        <View className="flex-row items-center gap-2 rounded-[12px] bg-muted px-3 py-2">
          <Icon icon={ArrowsClockwiseIcon} tone="muted" size={14} />
          <Text className="flex-1 text-[12.5px] text-muted-foreground">{scopeNote}</Text>
        </View>
      ) : null}
      <FormGroup>
        <TextInput
          testID="proto-editor-title"
          value={d.title}
          onChangeText={(title) => set({ title })}
          placeholder="Title"
          autoFocus={ed.mode === "create" && p.variant === "A"}
          className={cn(
            "px-4 py-3.5 font-sans text-foreground",
            p.variant === "C" ? "text-[22px] font-semibold" : "text-[16px]"
          )}
          placeholderTextColor="#9a9aa2"
        />
        {p.variant !== "B" ? (
          <>
            <Hair />
            <FormRow icon={UsersIcon} label="Group" value={p.groupName} />
          </>
        ) : null}
      </FormGroup>

      <FormGroup>
        <FormRow
          icon={ClockIcon}
          label="All day"
          accessory={<Switch value={d.allDay} onValueChange={(allDay) => set({ allDay })} />}
        />
        <Hair />
        <FormRow
          label="Starts"
          accessory={
            <View className="flex-row gap-1">
              <Picker
                mode="date"
                value={d.from}
                onChange={(from) => set({ from, to: d.to < from ? from : d.to })}
              />
              {!d.allDay ? (
                <Picker mode="time" value={d.start} onChange={(start) => set({ start })} />
              ) : null}
            </View>
          }
        />
        <Hair />
        <FormRow
          label="Ends"
          accessory={
            <View className="flex-row gap-1">
              <Picker
                mode="date"
                value={d.to}
                min={d.from}
                disabled={ruleLocked || d.rule.freq !== "none"}
                onChange={(to) => set({ to })}
              />
              {!d.allDay ? (
                <Picker mode="time" value={d.end} onChange={(end) => set({ end })} />
              ) : null}
            </View>
          }
        />
      </FormGroup>
      {d.rule.freq !== "none" ? (
        <Text className="-mt-2 px-4 text-[12px] text-faint">
          A recurring group event lasts one day.
        </Text>
      ) : null}

      <RepeatControls
        d={d}
        setRule={setRule}
        locked={ruleLocked}
        multiDay={multiDay}
        compact={p.variant === "B" && !moreOpen}
      />

      {p.variant === "B" && !moreOpen ? (
        <Pressable onPress={() => setMoreOpen(true)} className="items-center py-1">
          <Text className="text-[14px] font-semibold text-primary">
            More options: end date, note
          </Text>
        </Pressable>
      ) : (
        <FormGroup>
          <TextInput
            testID="proto-editor-note"
            value={d.note}
            onChangeText={(note) => set({ note })}
            placeholder="Note (optional)"
            multiline
            className="min-h-[72px] px-4 py-3 font-sans text-[15px] text-foreground"
            placeholderTextColor="#9a9aa2"
          />
        </FormGroup>
      )}

      {ed.mode === "edit" && p.variant !== "A" ? (
        <Pressable
          onPress={() => {
            close();
            setTimeout(() => p.askDelete({ event: original!, date: ed.date }), 600);
          }}
          className="items-center py-2"
        >
          <Text className="text-[15px] font-semibold text-danger">Delete group event</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (p.variant === "B") {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={close}>
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.38)" }}
            onPress={close}
          />
          <View
            testID="proto-editor"
            className="max-h-[88%] rounded-t-[28px] bg-background pt-2.5 pb-safe"
          >
            <View className="mx-auto mb-1 h-1 w-9 rounded-full bg-border" />
            <View className="flex-row items-center justify-between px-5 pb-2">
              <Text className="font-display text-[18px] font-semibold text-foreground">
                {title}
              </Text>
              <Pressable
                testID="proto-editor-save"
                onPress={submit}
                className="rounded-full bg-primary px-4 py-2"
              >
                <Text className="text-[14px] font-semibold text-primary-foreground">Save</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerClassName="gap-4 px-4 pb-6"
              keyboardShouldPersistTaps="handled"
            >
              {fields}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle={p.variant === "A" ? "pageSheet" : "fullScreen"}
      onRequestClose={close}
    >
      <View
        testID="proto-editor"
        className={cn("flex-1 bg-background", p.variant === "C" && "pt-safe")}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable testID="proto-editor-cancel" onPress={close} className="px-1 py-1">
            {p.variant === "C" ? (
              <Icon icon={XIcon} tone="foreground" size={22} />
            ) : (
              <Text className="text-[16px] text-primary">Cancel</Text>
            )}
          </Pressable>
          <Text className="text-[16px] font-semibold text-foreground">{title}</Text>
          <Pressable testID="proto-editor-save" onPress={submit} className="px-1 py-1">
            <Text className="text-[16px] font-semibold text-primary">
              {ed.mode === "create" ? "Add" : "Save"}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerClassName="gap-5 px-4 pt-2 pb-16"
          keyboardShouldPersistTaps="handled"
        >
          {fields}
          {ed.mode === "edit" && p.variant === "A" ? (
            <FormGroup>
              <Pressable
                onPress={() => {
                  close();
                  setTimeout(() => p.askDelete({ event: original!, date: ed.date }), 600);
                }}
                className="items-center py-3.5"
              >
                <Text className="text-[16px] text-danger">Delete group event</Text>
              </Pressable>
            </FormGroup>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function RepeatControls({
  d,
  setRule,
  locked,
  multiDay,
  compact,
}: {
  d: GroupEvent;
  setRule: (patch: Partial<Rule>) => void;
  locked: boolean;
  multiDay: boolean;
  compact: boolean;
}) {
  const r = d.rule;
  const startWd = monIndex(d.from);
  const unit = { none: "", daily: "day", weekly: "week", monthly: "month", yearly: "year" }[r.freq];
  const disabled = locked || multiDay;
  const preview = nextDates(d);

  return (
    <View className="gap-1.5">
      <FormGroup>
        <View className="gap-2 px-4 py-3">
          <View className="flex-row items-center gap-3">
            <Icon icon={ArrowsClockwiseIcon} tone="muted" />
            <Text className="flex-1 text-[15.5px] font-semibold text-foreground">Repeat</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-1.5"
          >
            {(["none", "daily", "weekly", "monthly", "yearly"] as const).map((f) => (
              <Pressable
                key={f}
                testID={`proto-repeat-${f}`}
                disabled={disabled}
                onPress={() =>
                  setRule({ freq: f, weekdays: f === "weekly" ? [startWd] : r.weekdays })
                }
                style={{ opacity: disabled ? 0.45 : 1 }}
                className={cn(
                  "rounded-full border px-3 py-1.5",
                  r.freq === f ? "border-foreground bg-foreground" : "border-input"
                )}
              >
                <Text
                  className={cn(
                    "text-[13px] font-semibold",
                    r.freq === f ? "text-background" : "text-foreground"
                  )}
                >
                  {f === "none" ? "Never" : f[0].toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {r.freq !== "none" ? (
          <>
            <Hair />
            <FormRow
              label={`Every ${r.interval} ${unit}${r.interval > 1 ? "s" : ""}`}
              accessory={
                <View className="flex-row items-center gap-1">
                  <StepButton
                    icon={MinusIcon}
                    disabled={locked || r.interval <= 1}
                    onPress={() => setRule({ interval: r.interval - 1 })}
                  />
                  <StepButton
                    icon={PlusIcon}
                    disabled={locked || r.interval >= 99}
                    onPress={() => setRule({ interval: r.interval + 1 })}
                  />
                </View>
              }
            />
          </>
        ) : null}
        {r.freq === "weekly" ? (
          <>
            <Hair />
            <View className="flex-row justify-between px-4 py-3">
              {WEEKDAYS.map((w, i) => {
                const on = i === startWd || r.weekdays.includes(i);
                return (
                  <Pressable
                    key={w}
                    disabled={locked || i === startWd}
                    onPress={() =>
                      setRule({
                        weekdays: on ? r.weekdays.filter((x) => x !== i) : [...r.weekdays, i],
                      })
                    }
                    className={cn(
                      "h-9 w-9 items-center justify-center rounded-full",
                      on ? "bg-foreground" : "bg-muted"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-[12px] font-bold",
                        on ? "text-background" : "text-muted-foreground"
                      )}
                    >
                      {w[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        {r.freq === "monthly" ? (
          <>
            <Hair />
            {nthOf(d.from) === 4 && Number(d.from.slice(8, 10)) > 28 ? null : null}
            <Choice
              label={`On day ${Number(d.from.slice(8, 10))}`}
              on={r.monthlyBy === "day"}
              disabled={locked}
              onPress={() => setRule({ monthlyBy: "day" })}
            />
            <Hair />
            <Choice
              label={`On the ${ORDINALS[nthOf(d.from)]} ${LONG_WEEKDAYS[startWd]}`}
              on={r.monthlyBy === "nth"}
              disabled={locked}
              onPress={() => setRule({ monthlyBy: "nth" })}
            />
          </>
        ) : null}
        {r.freq !== "none" && !compact ? (
          <>
            <Hair />
            <FormRow
              label="Ends"
              accessory={
                <View className="flex-row items-center gap-2">
                  <Text className="text-[13px] text-faint">{r.until ? "On" : "Never"}</Text>
                  <Switch
                    value={r.until !== null}
                    disabled={locked}
                    onValueChange={(on) => setRule({ until: on ? addDays(d.from, 90) : null })}
                  />
                  {r.until ? (
                    <Picker
                      mode="date"
                      value={r.until}
                      min={addDays(d.from, 1)}
                      disabled={locked}
                      onChange={(until) => setRule({ until })}
                    />
                  ) : null}
                </View>
              }
            />
          </>
        ) : null}
      </FormGroup>
      {multiDay ? (
        <Text className="px-4 text-[12px] text-faint">Only single-day events repeat.</Text>
      ) : null}
      {locked ? (
        <Text className="px-4 text-[12px] text-faint">
          The repeat rule changes only with “All events” or “This and following”.
        </Text>
      ) : null}
      {preview.length ? (
        <View testID="proto-next-dates" className="px-4 pt-1">
          <Text className="text-[11px] font-bold tracking-[1px] text-faint uppercase">
            Next dates
          </Text>
          <Text className="pt-1 text-[13px] leading-[19px] text-muted-foreground">
            {preview.map(shortDate).join(" · ")}
            {r.until ? "" : " · …"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function FormGroup({ children }: { children: ReactNode }) {
  return <View className="overflow-hidden rounded-[24px] bg-card">{children}</View>;
}

function Hair() {
  return <View className="ml-4 h-px bg-border" />;
}

function FormRow({
  icon,
  label,
  value,
  accessory,
}: {
  icon?: typeof PlusIcon;
  label: string;
  value?: string;
  accessory?: ReactNode;
}) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-2">
      {icon ? <Icon icon={icon} tone="muted" /> : null}
      <Text className="flex-1 text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text className="text-[14.5px] text-faint">{value}</Text> : null}
      {accessory}
    </View>
  );
}

function Choice({
  label,
  on,
  disabled,
  onPress,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="min-h-[46px] flex-row items-center px-4"
    >
      <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
      {on ? <Text className="text-[16px] font-bold text-primary">✓</Text> : null}
    </Pressable>
  );
}

function StepButton({
  icon,
  disabled,
  onPress,
}: {
  icon: typeof PlusIcon;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{ opacity: disabled ? 0.35 : 1 }}
      className="h-8 w-10 items-center justify-center rounded-[10px] bg-muted"
    >
      <Icon icon={icon} tone="foreground" size={15} weight="bold" />
    </Pressable>
  );
}

function Picker({
  mode,
  value,
  min,
  disabled,
  onChange,
}: {
  mode: "date" | "time";
  value: string;
  min?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const primary = useTone("primary");
  const date =
    mode === "date"
      ? parse(value)
      : new Date(2026, 0, 1, Number(value.slice(0, 2)), Number(value.slice(3, 5)));
  return (
    <DateTimePicker
      mode={mode}
      display="compact"
      value={date}
      minimumDate={min ? parse(min) : undefined}
      disabled={disabled}
      minuteInterval={mode === "time" ? 5 : undefined}
      accentColor={primary}
      onValueChange={(_e, next) =>
        onChange(mode === "date" ? iso(next) : `${pad(next.getHours())}:${pad(next.getMinutes())}`)
      }
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Pill

function Pill() {
  const p = useGroupEventsProto();
  const i = Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === p.variant)
  );
  const go = (delta: number) =>
    p.setVariant(VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length].key);
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, top: 52, alignItems: "center" }}
    >
      <View
        className="flex-row items-center gap-1 rounded-full px-2 py-1.5"
        style={{ backgroundColor: "#111", borderWidth: 2, borderColor: "#fde047" }}
      >
        <Pressable testID="proto-prev" onPress={() => go(-1)} className="px-2.5 py-1">
          <Text className="text-[15px] font-bold text-white">‹</Text>
        </Pressable>
        <Text className="text-[13px] font-semibold text-white">
          {VARIANTS[i].key} · {VARIANTS[i].name}
        </Text>
        <Pressable testID="proto-next" onPress={() => go(1)} className="px-2.5 py-1">
          <Text className="text-[15px] font-bold text-white">›</Text>
        </Pressable>
        <PillToggle
          testID="proto-role"
          label={p.admin ? "Admin" : "Member"}
          onPress={() => p.setAdmin(!p.admin)}
        />
        <PillToggle
          testID="proto-plan"
          label={p.pro ? "Pro" : "Free"}
          onPress={() => p.setPro(!p.pro)}
        />
      </View>
    </View>
  );
}

function PillToggle({
  testID,
  label,
  onPress,
}: {
  testID: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
    >
      <Text className="text-[12px] font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
