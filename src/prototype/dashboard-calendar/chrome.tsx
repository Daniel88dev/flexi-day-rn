// PROTOTYPE (T-34): shared dashboard pieces the three calendar variants sit inside. Throwaway.
import { useUnstableNativeVariable } from "nativewind";
import {
  AirplaneTiltIcon,
  CalendarDotsIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  FunnelSimpleIcon,
  PlusIcon,
  UsersThreeIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { ActionSheetIOS, Modal, Pressable, ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

import {
  APPROVALS,
  BALANCE,
  BG,
  GROUPS,
  MONTH_NAMES,
  PEOPLE,
  TEXT,
  TODAY,
  TYPE_LABEL,
  TYPE_ORDER,
  VIEWER_ID,
  bookingSpan,
  dayEntries,
  formatDay,
  formatSpan,
  personById,
  rowsInScope,
  stats,
  type LeaveType,
  type Person,
  type Range,
  type Scope,
} from "./model";

export function useVar(name: string, fallback: string): string {
  const v = (useUnstableNativeVariable as unknown as (n: string) => unknown)(name);
  return typeof v === "string" ? v : fallback;
}

export function Avatar({ person, size = 28 }: { person: Person; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: person.color }}
      className="items-center justify-center"
    >
      <Text style={{ fontSize: size * 0.4, color: "#fff" }} className="font-semibold">
        {person.initials}
      </Text>
    </View>
  );
}

export function Dot({ type, size = 9 }: { type: LeaveType; size?: number }) {
  return (
    <View className={BG[type]} style={{ width: size, height: size, borderRadius: size / 2 }} />
  );
}

/** A tinted fill: the token at an inline opacity, since `/16` modifiers paint nothing on this NativeWind. */
export function Tint({ type, opacity = 0.16 }: { type: LeaveType; opacity?: number }) {
  return <View className={cn("absolute inset-0", BG[type])} style={{ opacity }} />;
}

export const firstName = (name: string) => name.split(" ")[0];

export function nameFor(range: Range) {
  if (!range.user) return "Bank holiday";
  return range.user === VIEWER_ID ? "You" : firstName(personById(range.user).name);
}

// ---------------------------------------------------------------- page header

export function PageHeader({ onPlus }: { onPlus: () => void }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text
          className="font-display text-[28px] font-semibold text-foreground"
          style={{ letterSpacing: -0.56 }}
        >
          Good afternoon, Daniel
        </Text>
        <Text className="mt-1 text-[15px] leading-5 text-muted-foreground">
          Here is who is in and who is out.
        </Text>
      </View>
      <Pressable
        onPress={onPlus}
        accessibilityLabel="New request"
        className="mt-1 h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-90"
      >
        <PlusIcon size={20} weight="bold" color={useVar("--primary-fg", "#fff")} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------- stat strip

type Stat = {
  id: string;
  icon: PhosphorIcon;
  tone: string; // css var
  softClass: string;
  label: string;
  value: number;
  sub: string;
  link?: string;
  accent?: boolean;
};

function StatTile({ stat, open, onPress }: { stat: Stat; open: boolean; onPress: () => void }) {
  const color = useVar(stat.tone, "#888");
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-1 items-center gap-1.5 overflow-hidden rounded-[16px] border bg-card px-1 py-3",
        open ? "border-input" : "border-border"
      )}
    >
      <View className={cn("h-7 w-7 items-center justify-center rounded-[9px]", stat.softClass)}>
        <stat.icon size={18} color={color} weight="bold" />
      </View>
      <Text
        className={cn(
          "font-display text-[22px] font-bold",
          stat.accent ? "text-warm" : "text-foreground"
        )}
        style={{ letterSpacing: -0.6 }}
      >
        {stat.value}
      </Text>
    </Pressable>
  );
}

export function StatStrip({
  approver,
  scope,
  onLink,
}: {
  approver: boolean;
  scope: Scope;
  onLink: (to: string) => void;
}) {
  const s = stats(scope);
  const primary = useVar("--primary", "#6a5ec6");
  const [openId, setOpenId] = useState<string | null>(null);
  const all: Stat[] = [
    ...(approver
      ? [
          {
            id: "pending",
            icon: ClockIcon,
            tone: "--warm",
            softClass: "bg-warm-soft",
            label: "Pending approvals",
            value: APPROVALS.length,
            sub: "waiting for you",
            link: "/requests?filter=pending",
            accent: true,
          },
        ]
      : []),
    {
      id: "out",
      icon: AirplaneTiltIcon,
      tone: "--c-vacation",
      softClass: "bg-accent",
      label: "Out today",
      value: s.outToday,
      sub: scope.kind === "mine" ? "that's you" : "people away today",
    },
    {
      id: "coming",
      icon: CalendarDotsIcon,
      tone: "--c-pto",
      softClass: "bg-muted",
      label: "Coming up",
      value: s.comingUp,
      sub: "requests in the next 14 days",
      link: "/requests",
    },
    {
      id: "working",
      icon: UsersThreeIcon,
      tone: "--c-home",
      softClass: "bg-ok-soft",
      label: "Working today",
      value: s.workingToday,
      sub: "in the office or at home",
    },
  ];
  const open = all.find((x) => x.id === openId);
  return (
    <View>
      <View className="flex-row gap-2">
        {all.map((st) => (
          <StatTile
            key={st.id}
            stat={st}
            open={st.id === openId}
            onPress={() => setOpenId(st.id === openId ? null : st.id)}
          />
        ))}
      </View>
      {open ? (
        <View className="mt-2 flex-row items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3">
          <View className="flex-1">
            <Text className="text-[14px] font-semibold text-foreground">{open.label}</Text>
            <Text className="text-[13px] text-faint">
              {open.value} {open.sub}
            </Text>
          </View>
          {open.link ? (
            <Pressable onPress={() => onLink(open.link!)} className="flex-row items-center gap-0.5">
              <Text className="text-[13px] font-semibold text-primary">View requests</Text>
              <CaretRightIcon size={13} color={primary} weight="bold" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- calendar header

export function MonthStepper({
  year,
  month,
  onStep,
  canPrev,
  canNext,
}: {
  year: number;
  month: number;
  onStep: (delta: number) => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const muted = useVar("--text-muted", "#666");
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-display text-[22px] font-semibold text-foreground">
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <View className="flex-row gap-1.5">
        {[-1, 1].map((d) => (
          <Pressable
            key={d}
            disabled={d < 0 ? !canPrev : !canNext}
            onPress={() => onStep(d)}
            className={cn(
              "h-9 w-9 items-center justify-center rounded-full border border-input bg-card active:opacity-70",
              (d < 0 ? !canPrev : !canNext) && "opacity-40"
            )}
          >
            {d < 0 ? (
              <CaretLeftIcon size={16} color={muted} weight="bold" />
            ) : (
              <CaretRightIcon size={16} color={muted} weight="bold" />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ScopeAndFilter({
  scope,
  setScope,
  filter,
  onFilter,
}: {
  scope: Scope;
  setScope: (s: Scope) => void;
  filter: Set<LeaveType>;
  onFilter: () => void;
}) {
  const faint = useVar("--text-faint", "#999");
  const groupId = scope.kind === "group" ? scope.groupId : GROUPS[0].id;
  const pickGroup = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...GROUPS.map((g) => g.name), "Cancel"],
        cancelButtonIndex: GROUPS.length,
        title: "Show group",
      },
      (i) => i < GROUPS.length && setScope({ kind: "group", groupId: GROUPS[i].id })
    );
  const all = filter.size === TYPE_ORDER.length;
  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-row rounded-full bg-muted p-0.5">
        {(["mine", "group"] as const).map((k) => {
          const on = scope.kind === k;
          return (
            <Pressable
              key={k}
              onPress={() => setScope(k === "mine" ? { kind: "mine" } : { kind: "group", groupId })}
              className={cn("rounded-full px-3.5 py-1.5", on && "bg-primary")}
            >
              <Text
                className={cn(
                  "text-[13px] font-semibold",
                  on ? "text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {k === "mine" ? "Mine" : "Group"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {scope.kind === "group" ? (
        <Pressable
          onPress={pickGroup}
          className="flex-row items-center gap-1 rounded-full border border-input bg-card px-3 py-1.5"
        >
          <Text className="text-[13px] font-semibold text-foreground">
            {GROUPS.find((g) => g.id === groupId)!.name}
          </Text>
          <CaretDownIcon size={12} color={faint} weight="bold" />
        </Pressable>
      ) : null}
      <View className="flex-1" />
      <Pressable
        onPress={onFilter}
        className="flex-row items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5"
      >
        <FunnelSimpleIcon size={14} color={faint} weight="bold" />
        <Text className="text-[13px] font-semibold text-foreground">
          {all ? "All types" : `${filter.size} types`}
        </Text>
      </Pressable>
    </View>
  );
}

export function Legend({ ranges }: { ranges: Range[] }) {
  const types = TYPE_ORDER.filter((t) => ranges.some((r) => r.type === t));
  if (types.length === 0) return null;
  return (
    <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1.5 px-1">
      {types.map((t) => (
        <View key={t} className="flex-row items-center gap-1.5">
          <Dot type={t} />
          <Text className="text-[12.5px] font-medium text-muted-foreground">{TYPE_LABEL[t]}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View className="h-[9px] w-[14px] rounded-[3px] border border-dashed border-input" />
        <Text className="text-[12.5px] font-medium text-muted-foreground">Pending</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- sheets

function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" onPress={onClose}>
        <View className="absolute inset-0 bg-foreground" style={{ opacity: 0.18 }} />
      </Pressable>
      <View className="max-h-[70%] rounded-t-[28px] border-t border-border bg-card pb-safe">
        <View className="items-center pt-2.5 pb-1">
          <View className="h-1 w-10 rounded-full bg-input" />
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function FilterSheet({
  open,
  onClose,
  filter,
  setFilter,
}: {
  open: boolean;
  onClose: () => void;
  filter: Set<LeaveType>;
  setFilter: (f: Set<LeaveType>) => void;
}) {
  const primary = useVar("--primary", "#6a5ec6");
  const all = filter.size === TYPE_ORDER.length;
  return (
    <Sheet open={open} onClose={onClose}>
      <View className="flex-row items-center justify-between px-5 pt-1 pb-2">
        <Text className="font-display text-[18px] font-semibold text-foreground">Show types</Text>
        <Pressable onPress={() => setFilter(new Set(all ? [] : TYPE_ORDER))}>
          <Text className="text-[14px] font-semibold text-primary">
            {all ? "Clear all" : "Select all"}
          </Text>
        </Pressable>
      </View>
      <ScrollView className="px-3">
        {TYPE_ORDER.map((t) => {
          const on = filter.has(t);
          return (
            <Pressable
              key={t}
              onPress={() => {
                const n = new Set(filter);
                if (on) n.delete(t);
                else n.add(t);
                setFilter(n);
              }}
              className="flex-row items-center gap-3 rounded-[16px] px-2 py-3 active:bg-muted"
            >
              <View style={{ opacity: on ? 1 : 0.35 }}>
                <Dot type={t} size={11} />
              </View>
              <Text className={cn("flex-1 text-[15px]", on ? "text-foreground" : "text-faint")}>
                {TYPE_LABEL[t]}
              </Text>
              {on ? <CheckIcon size={18} color={primary} weight="bold" /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

/** "+N more" and a tapped day both land here: everyone on that day, then a way to book it. */
export function DaySheet({
  dayIso,
  onClose,
  scope,
  filter,
  onOpen,
  onBook,
}: {
  dayIso: string | null;
  onClose: () => void;
  scope: Scope;
  filter: Set<LeaveType>;
  onOpen: (bookingId: string) => void;
  onBook: (dayIso: string) => void;
}) {
  const onPrimary = useVar("--primary-fg", "#fff");
  const entries = dayIso ? dayEntries(dayIso, scope, filter) : { holidays: [], rows: [] };
  return (
    <Sheet open={dayIso !== null} onClose={onClose}>
      <View className="px-5 pt-1 pb-2">
        <Text className="font-display text-[18px] font-semibold text-foreground">
          {dayIso ? formatDay(dayIso) : ""}
        </Text>
        <Text className="text-[13px] text-faint">
          {entries.rows.length === 0 ? "Nobody is away" : `${entries.rows.length} away or remote`}
        </Text>
      </View>
      <ScrollView className="px-3">
        {entries.holidays.map((h) => (
          <View
            key={h.date}
            className="mb-1 flex-row items-center gap-3 overflow-hidden rounded-[16px] px-3 py-3"
          >
            <Tint type="BANK_HOLIDAY" />
            <Dot type="BANK_HOLIDAY" size={11} />
            <Text className="flex-1 text-[15px] font-semibold text-leave-bank">{h.name}</Text>
          </View>
        ))}
        {entries.rows.map((r) => (
          <AgendaRow key={r.id} row={r} onPress={() => onOpen(r.bookingId)} />
        ))}
      </ScrollView>
      {dayIso ? (
        <View className="px-5 pt-3">
          <Pressable
            onPress={() => onBook(dayIso)}
            className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-90"
          >
            <PlusIcon size={16} weight="bold" color={onPrimary} />
            <Text className="text-[15px] font-semibold text-primary-foreground">
              Book {formatDay(dayIso)}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}

export function AgendaRow({
  row,
  onPress,
}: {
  row: ReturnType<typeof rowsInScope>[number];
  onPress: () => void;
}) {
  const p = personById(row.user);
  const span = bookingSpan(row.bookingId);
  const pending = row.status === "pending";
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[16px] px-2 py-2.5 active:bg-muted"
    >
      <View className={cn("h-8 w-[3px] rounded-full", BG[row.type])} />
      <Avatar person={p} size={32} />
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {row.user === VIEWER_ID ? "You" : p.name}
        </Text>
        <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
          {TYPE_LABEL[row.type]}
          {row.halfDay ? " · half day" : ""}
          {row.note ? ` · ${row.note}` : ""} · {formatSpan(span.from, span.to)}
        </Text>
      </View>
      {pending ? (
        <View className="rounded-full bg-warm-soft px-2 py-0.5">
          <Text className="text-[11.5px] font-semibold text-warm">Pending</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- widgets under the calendar

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="rounded-[24px] border border-border bg-card p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-display text-[16px] font-semibold text-foreground">{title}</Text>
        {badge}
      </View>
      {children}
    </View>
  );
}

export function ApprovalsWidget({ onOpen }: { onOpen: (id: string) => void }) {
  const ok = useVar("--c-home", "#3f8f7a");
  const onPrimary = useVar("--primary-fg", "#fff");
  const [done, setDone] = useState<Set<string>>(new Set());
  const items = APPROVALS.filter((a) => !done.has(a.bookingId));
  return (
    <Card
      title="Approvals"
      badge={
        items.length > 0 ? (
          <View className="rounded-full bg-warm-soft px-2.5 py-1">
            <Text className="text-[12.5px] font-semibold text-warm">{items.length} to review</Text>
          </View>
        ) : null
      }
    >
      {items.length === 0 ? (
        <View className="flex-row items-center gap-2.5 py-2">
          <CheckCircleIcon size={20} color={ok} />
          <Text className="text-[14px] text-muted-foreground">All caught up</Text>
        </View>
      ) : (
        <View className="gap-4">
          {items.map((a) => {
            const p = personById(a.user);
            return (
              <View key={a.bookingId} className="flex-row items-start gap-3">
                <Avatar person={p} size={38} />
                <View className="flex-1">
                  <Pressable onPress={() => onOpen(a.bookingId)}>
                    <Text className="text-[14.5px] font-semibold text-foreground">{p.name}</Text>
                    <Text className="mb-2 text-[12.5px] text-faint">
                      {TYPE_LABEL[a.type]} · {formatSpan(a.from, a.to)} · {a.days} days
                    </Text>
                  </Pressable>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setDone(new Set([...done, a.bookingId]))}
                      className="flex-row items-center gap-1 rounded-full bg-primary px-3.5 py-2"
                    >
                      <CheckIcon size={13} color={onPrimary} weight="bold" />
                      <Text className="text-[13.5px] font-semibold text-primary-foreground">
                        Approve
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDone(new Set([...done, a.bookingId]))}
                      className="rounded-full border border-input px-3.5 py-2"
                    >
                      <Text className="text-[13.5px] font-semibold text-foreground">Decline</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

export function OutTodayWidget({ scope }: { scope: Scope }) {
  const rows = rowsInScope(scope).filter((r) => r.day === TODAY && r.status === "approved");
  return (
    <Card
      title="Out today"
      badge={
        <View className="rounded-full border border-border bg-muted px-2.5 py-1">
          <Text className="text-[12.5px] font-semibold text-muted-foreground">
            {rows.length} away
          </Text>
        </View>
      }
    >
      {rows.length === 0 ? (
        <Text className="text-[14px] text-muted-foreground">Everyone is in today.</Text>
      ) : (
        <View className="gap-3">
          {rows.map((r) => (
            <View key={r.id} className="flex-row items-center gap-3">
              <Avatar person={personById(r.user)} size={34} />
              <Text className="flex-1 text-[14.5px] font-semibold text-foreground">
                {r.user === VIEWER_ID ? "You" : personById(r.user).name}
              </Text>
              <View className="flex-row items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1">
                <Tint type={r.type} />
                <Text className={cn("text-[12px] font-semibold", TEXT[r.type])}>
                  {TYPE_LABEL[r.type]}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export function BalanceWidget() {
  return (
    <Card title="Your balance 2026">
      <View className="gap-4">
        {BALANCE.map((b) => (
          <View key={b.type}>
            <View className="mb-2 flex-row items-baseline justify-between">
              <Text className="text-[13.5px] font-semibold text-foreground">
                {TYPE_LABEL[b.type]}
              </Text>
              <Text className="text-[13px] text-muted-foreground">
                <Text className="font-bold text-foreground">{b.allocated - b.used}</Text> /{" "}
                {b.allocated} left
                {b.pending ? <Text className="text-faint"> · {b.pending} pending</Text> : null}
              </Text>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-muted">
              <View
                className={cn("h-2 rounded-full", BG[b.type])}
                style={{ width: `${(b.used / b.allocated) * 100}%` }}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------- prototype chrome

const mono = { fontFamily: "Menlo", fontSize: 11, color: "#fff" } as const;

export function Switcher({
  label,
  onPrev,
  onNext,
  chips,
  lastAction,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  chips: { label: string; onPress: () => void }[];
  lastAction: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!__DEV__) return null;
  const Chip = ({ text, onPress }: { text: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3 py-1.5 active:opacity-80"
      style={{ backgroundColor: "#15131c" }}
    >
      <Text style={mono}>{text}</Text>
    </Pressable>
  );
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 items-center pb-safe">
      {lastAction ? (
        <View className="mb-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: "#2a2140" }}>
          <Text style={mono}>{lastAction}</Text>
        </View>
      ) : null}
      {open ? (
        <View className="mb-1.5 flex-row flex-wrap justify-center gap-1.5 px-4">
          {chips.map((c) => (
            <Chip key={c.label} text={c.label} onPress={c.onPress} />
          ))}
        </View>
      ) : null}
      <View className="mb-2 flex-row gap-1.5">
        <Chip text="‹" onPress={onPrev} />
        <Chip text={open ? `x ${label}` : label} onPress={() => setOpen(!open)} />
        <Chip text="›" onPress={onNext} />
      </View>
    </View>
  );
}

export const everyoneCount = PEOPLE.length;
