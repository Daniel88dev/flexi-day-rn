// PROTOTYPE (T-35): the clock sheet's pieces, three sheet variants and three tab-bar discs. Throwaway.
import { useUnstableNativeVariable } from "nativewind";
import {
  ArrowClockwiseIcon,
  CalendarBlankIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  CoffeeIcon,
  ListIcon,
  LockSimpleIcon,
  MapPinIcon,
  PlayIcon,
  SignInIcon,
  SignOutIcon,
  SquaresFourIcon,
  TimerIcon,
  WarningCircleIcon,
  WifiSlashIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { Fragment, useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";

import {
  BREAK_ALLOWANCE_MS,
  REQUIRED_MS,
  SCENARIOS,
  act,
  answerPrompt,
  dismissNotice,
  fmtClock,
  fmtDur,
  fmtShort,
  get,
  hhmm,
  loadScenario,
  openBreakOf,
  openSessionOf,
  phaseOf,
  reread,
  retry,
  set,
  setPrefs,
  totals,
  useProto,
  webClockIn,
  type Phase,
  type ProtoState,
} from "./model";

export function useVar(name: string, fallback: string): string {
  const v = (useUnstableNativeVariable as unknown as (n: string) => unknown)(name);
  return typeof v === "string" ? v : fallback;
}

const TNUM = { fontVariant: ["tabular-nums" as const] };

const FACE: Record<
  Phase,
  { label: string; icon: PhosphorIcon; tone: string; bg: string; fg: string }
> = {
  out: {
    label: "Not clocked in",
    icon: ClockIcon,
    tone: "--text-muted",
    bg: "bg-primary",
    fg: "--primary-fg",
  },
  in: { label: "Clocked in", icon: PlayIcon, tone: "--ok", bg: "bg-ok", fg: "--bg" },
  break: { label: "On break", icon: CoffeeIcon, tone: "--warm", bg: "bg-warm", fg: "--bg" },
  inactive: {
    label: "Clocking in is off",
    icon: LockSimpleIcon,
    tone: "--text-faint",
    bg: "bg-muted",
    fg: "--text-faint",
  },
};

/** The running span the big timer shows: the open break if there is one, else the open session. */
export function running(s: ProtoState) {
  return openBreakOf(s.cache) ?? openSessionOf(s.cache);
}

// ---------------------------------------------------------------- tab-bar disc

export function Disc({ onPress }: { onPress: () => void }) {
  const s = useProto();
  const phase = phaseOf(s.cache);
  const run = s.cache ? running(s) : null;
  const now = useNow(1000);
  const face = FACE[phase ?? "out"];
  const fg = useVar(face.fg, "#fff");
  const muted = useVar("--text-muted", "#888");
  const time = run ? fmtShort(now - run.start) : null;
  const label =
    phase === "in" && time ? time : phase === "break" ? "On break" : phase === null ? " " : "Clock";
  const offlineBadge = !s.online ? (
    <View className="absolute -top-1 -right-1 h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-card">
      <WifiSlashIcon size={11} color={muted} weight="bold" />
    </View>
  ) : null;

  const style = s.prefs.disc;
  const discBg = phase === null ? "bg-muted" : face.bg;

  if (style === "capsule" && time) {
    return (
      <Pressable onPress={onPress} style={SLOT} accessibilityLabel="Clock">
        <View className="-mt-[26px] rounded-full bg-background p-[5px]">
          <View className={cn("h-[54px] flex-row items-center gap-1.5 rounded-full px-4", discBg)}>
            <face.icon size={18} color={fg} weight="fill" />
            <Text className="font-display text-[17px] font-bold" style={[TNUM, { color: fg }]}>
              {phase === "break" && run ? fmtShort(now - run.start) : time}
            </Text>
            {offlineBadge}
          </View>
        </View>
        <Text className="text-[10px] font-semibold text-muted-foreground">
          {phase === "break" ? "On break" : "Clocked in"}
        </Text>
      </Pressable>
    );
  }

  const Glyph = phase === "in" ? SignOutIcon : phase === "break" ? CoffeeIcon : TimerIcon;
  return (
    <Pressable onPress={onPress} style={SLOT} accessibilityLabel="Clock">
      <View className="-mt-[26px] rounded-full bg-background p-[5px]">
        <View className={cn("h-[54px] w-[54px] items-center justify-center rounded-full", discBg)}>
          {style === "inside" && time ? (
            <Text className="font-display text-[15px] font-bold" style={[TNUM, { color: fg }]}>
              {phase === "break" && run ? fmtShort(now - run.start) : time}
            </Text>
          ) : s.loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <Glyph size={26} color={fg} />
          )}
          {offlineBadge}
        </View>
      </View>
      <Text className="text-[10px] font-semibold text-muted-foreground" style={TNUM}>
        {style === "inside" ? (phase === "break" ? "On break" : "Clock") : label}
      </Text>
    </Pressable>
  );
}

const SLOT = {
  flex: 1,
  height: 50,
  alignItems: "center",
  justifyContent: "flex-end",
  paddingBottom: 6,
} as const;

function Tab({
  icon: G,
  label,
  focused,
}: {
  icon: PhosphorIcon;
  label: string;
  focused?: boolean;
}) {
  const c = useVar(focused ? "--primary" : "--text-muted", "#888");
  return (
    <View
      style={{
        flex: 1,
        height: 50,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        paddingTop: 4,
      }}
    >
      <G size={25} color={c} weight={focused ? "fill" : "regular"} />
      <Text
        className={cn(
          "text-[10px] font-semibold",
          focused ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </Text>
    </View>
  );
}

export function TabBar({ onClock }: { onClock: () => void }) {
  return (
    <View className="flex-row border-t border-border bg-card pb-safe">
      <Tab icon={SquaresFourIcon} label="Dashboard" focused />
      <Tab icon={CalendarBlankIcon} label="Requests" />
      <Disc onPress={onClock} />
      <Tab icon={TimerIcon} label="My attendance" />
      <Tab icon={ListIcon} label="More" />
    </View>
  );
}

// ---------------------------------------------------------------- notices

function Notice({
  tone,
  icon: G,
  title,
  children,
  action,
}: {
  tone: "muted" | "warn" | "danger" | "accent";
  icon: PhosphorIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const surface = {
    muted: "bg-muted",
    warn: "bg-warm-soft",
    danger: "bg-danger-soft",
    accent: "bg-accent",
  }[tone];
  const iconTone = useVar(
    { muted: "--text-muted", warn: "--warm", danger: "--danger", accent: "--primary" }[tone],
    "#888"
  );
  return (
    <View className={cn("flex-row gap-3 rounded-[16px] p-3.5", surface)}>
      <View className="pt-0.5">
        <G size={18} color={iconTone} weight="bold" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-[14.5px] font-semibold text-foreground">{title}</Text>
        {children ? (
          <Text className="text-[13.5px] leading-[19px] text-muted-foreground">{children}</Text>
        ) : null}
        {action ? <View className="mt-1.5 flex-row gap-2">{action}</View> : null}
      </View>
    </View>
  );
}

function SmallButton({
  label,
  icon: G,
  onPress,
  disabled,
}: {
  label: string;
  icon?: PhosphorIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useVar("--text", "#222");
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "h-9 flex-row items-center gap-1.5 rounded-full border border-input bg-card px-3.5 active:opacity-80",
        disabled && "opacity-50"
      )}
    >
      {G ? <G size={15} color={c} weight="bold" /> : null}
      <Text className="text-[13.5px] font-semibold text-foreground">{label}</Text>
    </Pressable>
  );
}

function Notices({ s, onLink }: { s: ProtoState; onLink: (to: string) => void }) {
  const phase = phaseOf(s.cache);
  const out: ReactNode[] = [];

  if (!s.online) {
    out.push(
      <Notice
        key="offline"
        tone="muted"
        icon={WifiSlashIcon}
        title="Can't reach the server"
        action={
          <SmallButton
            label="Try again"
            icon={ArrowClockwiseIcon}
            onPress={() => reread("retry")}
          />
        }
      >
        {s.cache && s.readAt
          ? `Showing what the phone knew at ${hhmm(s.readAt)}. Clocking waits until you're back online.`
          : "Your clock loads once you're back online."}
      </Notice>
    );
  }

  if (s.locationEnabled && !s.noticeDismissed && phase !== "inactive") {
    out.push(
      <Notice
        key="loc"
        tone="accent"
        icon={MapPinIcon}
        title="Your organization records where you clock"
        action={
          <>
            <SmallButton label="Got it" onPress={dismissNotice} />
            <SmallButton label="Privacy policy" onPress={() => onLink("web /privacy")} />
          </>
        }
      >
        Your iPhone asks for your location when you clock in and out. You can say no. Nothing is
        recorded then, and it changes nothing else.
      </Notice>
    );
  }

  if (s.conflictStartedAt) {
    out.push(
      <Notice
        key="409"
        tone="warn"
        icon={ClockIcon}
        title={`Clocked in since ${hhmm(s.conflictStartedAt)}`}
      >
        You were already clocked in somewhere else. Clock out when you are done.
      </Notice>
    );
  }

  if (s.error && s.prefs.errors === "inline") {
    out.push(
      <Notice
        key="err"
        tone={s.error.kind === "network" ? "danger" : "warn"}
        icon={s.error.kind === "network" ? WifiSlashIcon : WarningCircleIcon}
        title={s.error.title}
        action={
          s.error.retry ? (
            <SmallButton label="Retry" icon={ArrowClockwiseIcon} onPress={retry} />
          ) : undefined
        }
      >
        {s.error.body}
      </Notice>
    );
  }

  if (s.autoClosed) {
    out.push(
      <Notice
        key="auto"
        tone="warn"
        icon={ClockCounterClockwiseIcon}
        title="Thursday was closed for you"
        action={
          <SmallButton
            label="Set the time"
            icon={CaretRightIcon}
            onPress={() => onLink("/my-attendance?date=2026-09-24")}
          />
        }
      >
        The session reached 16h 00m and was closed at 23:58 on Thursday. Set the time you actually
        left.
      </Notice>
    );
  }

  if (phase === "inactive" && s.cache) {
    const stranded = openSessionOf(s.cache) !== null;
    out.push(
      <Notice
        key="inactive"
        tone="muted"
        icon={LockSimpleIcon}
        title={s.cache.employmentEnded ? "Your employment here has ended" : "Clocking in is off"}
        action={
          stranded ? (
            <SmallButton
              label={s.busy === "out" ? "Clocking out..." : "Clock out"}
              icon={SignOutIcon}
              disabled={!!s.busy || !s.online}
              onPress={() => act("out")}
            />
          ) : undefined
        }
      >
        {stranded
          ? "Attendance is paused for your organization. You can still close the session you left running, and nothing new can be started."
          : "Attendance is paused for your organization, so there is nothing to clock. Your history stays readable."}
      </Notice>
    );
  }

  return out.length ? <View className="gap-2.5">{out}</View> : null;
}

// ---------------------------------------------------------------- actions

function BigButton({
  label,
  busyLabel,
  icon: G,
  kind,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busyLabel: string;
  icon: PhosphorIcon;
  kind: "primary" | "secondary" | "ok" | "warm";
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const bg = {
    primary: "bg-primary",
    secondary: "bg-secondary border border-input",
    ok: "bg-ok",
    warm: "bg-warm",
  }[kind];
  const fg = useVar(
    kind === "secondary" ? "--text" : kind === "primary" ? "--primary-fg" : "--bg",
    "#fff"
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className={cn(
        "h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full px-5 active:opacity-90",
        bg,
        disabled && !busy && "opacity-50"
      )}
    >
      {busy ? <ActivityIndicator color={fg} /> : <G size={19} color={fg} weight="bold" />}
      <Text className="text-[16px] font-semibold" style={{ color: fg }}>
        {busy ? busyLabel : label}
      </Text>
    </Pressable>
  );
}

function Actions({ s, stacked }: { s: ProtoState; stacked?: boolean }) {
  const phase = phaseOf(s.cache);
  const off = !s.online;
  const b = (k: typeof s.busy) => s.busy === k;
  // A busy re-read after a write keeps the button that was pressed spinning.
  if (phase === "out" && !s.conflictStartedAt) {
    return (
      <BigButton
        label="Clock in"
        busyLabel="Clocking in..."
        icon={SignInIcon}
        kind="primary"
        busy={b("in") || (b("reread") && s.lastAction?.includes("clock-in") === true)}
        disabled={off || !!s.busy}
        onPress={() => act("in")}
      />
    );
  }
  if (phase === "in") {
    return (
      <View className={cn("gap-2.5", stacked ? "" : "flex-row")}>
        <BigButton
          label="Take a break"
          busyLabel="Starting..."
          icon={CoffeeIcon}
          kind="secondary"
          busy={b("break")}
          disabled={off || !!s.busy}
          onPress={() => act("break")}
        />
        <BigButton
          label="Clock out"
          busyLabel="Clocking out..."
          icon={SignOutIcon}
          kind="primary"
          busy={b("out")}
          disabled={off || !!s.busy}
          onPress={() => act("out")}
        />
      </View>
    );
  }
  if (phase === "break") {
    return (
      <View className={cn("gap-2.5", stacked ? "" : "flex-row")}>
        <BigButton
          label="End break"
          busyLabel="Ending..."
          icon={PlayIcon}
          kind="primary"
          busy={b("resume")}
          disabled={off || !!s.busy}
          onPress={() => act("resume")}
        />
        <BigButton
          label="Clock out"
          busyLabel="Clocking out..."
          icon={SignOutIcon}
          kind="secondary"
          busy={b("out")}
          disabled={off || !!s.busy}
          onPress={() => act("out")}
        />
      </View>
    );
  }
  if (phase === "out" && s.conflictStartedAt) return null;
  return null;
}

function LocationLine({ s }: { s: ProtoState }) {
  const muted = useVar("--text-muted", "#888");
  const { loc } = s;
  if (s.prefs.locLine === "quiet" || loc.stage === "idle") return null;
  const verb = loc.end === "OUT" ? "Clock-out" : "Clock-in";
  let text = "";
  let spin = false;
  if (loc.stage === "asking") text = "Waiting for your answer...";
  else if (loc.stage === "skipped") text = `${verb} saved without a location.`;
  else if (loc.stage === "coarse") {
    text = "Finding your location...";
    spin = true;
  } else if (loc.stage === "precise") {
    spin = true;
    text =
      loc.coarse === undefined
        ? "Still looking for your location..."
        : loc.approx
          ? `Approximate location saved (about ${(loc.coarse / 1000).toFixed(0)} km).`
          : `Location saved (±${loc.coarse} m), sharpening...`;
  } else if (loc.stage === "done") {
    const best = loc.precise ?? loc.coarse;
    text =
      best === undefined
        ? `${verb} saved without a location. No fix came.`
        : loc.approx
          ? `Approximate location saved (about ${(best / 1000).toFixed(0)} km). Precise location is off for Flexi Day.`
          : `${verb} location saved (±${best} m).`;
  }
  return (
    <View className="flex-row items-center justify-center gap-1.5">
      {spin ? (
        <ActivityIndicator size="small" color={muted} />
      ) : (
        <MapPinIcon size={14} color={muted} />
      )}
      <Text className="text-[12.5px] text-muted-foreground">{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- totals, timeline, link

function DayTotals({
  s,
  now,
  withRequired,
}: {
  s: ProtoState;
  now: number;
  withRequired?: boolean;
}) {
  const t = totals(s.cache, now);
  const cells = withRequired
    ? [
        ["Worked", fmtDur(t.work)],
        ["Required", fmtDur(REQUIRED_MS)],
        ["Left", fmtDur(REQUIRED_MS - t.work)],
      ]
    : [
        ["Presence", fmtDur(t.presence)],
        ["Breaks", fmtDur(t.breaks)],
        ["Sessions", String(t.count)],
      ];
  return (
    <View className="flex-row border-t border-border pt-3.5">
      {cells.map(([k, v]) => (
        <View key={k} className="flex-1 gap-0.5">
          <Text className="text-[11px] font-bold tracking-[0.6px] text-faint uppercase">{k}</Text>
          <Text className="text-[18px] font-semibold text-foreground" style={TNUM}>
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AttendanceLink({ onLink }: { onLink: (to: string) => void }) {
  const c = useVar("--text", "#222");
  const m = useVar("--text-muted", "#888");
  return (
    <Pressable
      onPress={() => onLink("/my-attendance")}
      className="h-12 flex-row items-center gap-3 rounded-[16px] bg-muted px-4 active:opacity-80"
    >
      <TimerIcon size={19} color={c} />
      <Text className="flex-1 text-[15px] font-semibold text-foreground">View my attendance</Text>
      <CaretRightIcon size={16} color={m} weight="bold" />
    </Pressable>
  );
}

function Timeline({ s, now }: { s: ProtoState; now: number }) {
  const sessions = s.cache?.sessions ?? [];
  const first = sessions[0]?.start ?? now;
  const d0 = new Date(Math.min(first, now - 60 * 60_000));
  d0.setMinutes(0, 0, 0);
  const start = d0.getTime();
  const end = Math.max(now + 60 * 60_000, start + 9 * 3600_000);
  const pct = (t: number) => `${((t - start) / (end - start)) * 100}%` as const;
  const w = (a: number, b: number) => `${((b - a) / (end - start)) * 100}%` as const;
  const hours: number[] = [];
  for (let h = start; h <= end; h += 3 * 3600_000) hours.push(h);
  return (
    <View className="gap-1.5">
      <View className="h-7 overflow-hidden rounded-[8px] bg-muted">
        {sessions.map((x, i) => (
          <Fragment key={i}>
            <View
              className="absolute top-0 bottom-0 bg-ok"
              style={{ left: pct(x.start), width: w(x.start, x.end ?? now) }}
            />
            {x.breaks.map((b, j) => (
              <View
                key={j}
                className="absolute top-0 bottom-0 bg-warm"
                style={{ left: pct(b.start), width: w(b.start, b.end ?? now) }}
              />
            ))}
          </Fragment>
        ))}
        <View
          className="absolute top-0 bottom-0 w-[2px] bg-foreground"
          style={{ left: pct(now) }}
        />
      </View>
      <View className="h-4">
        {hours.map((h) => (
          <Text
            key={h}
            className="absolute text-[10.5px] text-faint"
            style={[TNUM, { left: pct(h), marginLeft: -12 }]}
          >
            {hhmm(h)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function SessionRows({ s, now }: { s: ProtoState; now: number }) {
  const rows: { k: string; label: string; span: string; len: string; tone: string }[] = [];
  for (const x of s.cache?.sessions ?? []) {
    rows.push({
      k: `s${x.start}`,
      label: "Work",
      span: `${hhmm(x.start)} - ${x.end ? hhmm(x.end) : "now"}`,
      len: fmtDur((x.end ?? now) - x.start),
      tone: "bg-ok",
    });
    for (const b of x.breaks)
      rows.push({
        k: `b${b.start}`,
        label: "Break",
        span: `${hhmm(b.start)} - ${b.end ? hhmm(b.end) : "now"}`,
        len: fmtDur((b.end ?? now) - b.start),
        tone: "bg-warm",
      });
  }
  if (!rows.length)
    return (
      <Text className="py-2 text-[13.5px] text-muted-foreground">Nothing recorded today yet.</Text>
    );
  return (
    <View className="gap-1">
      {rows.map((r) => (
        <View key={r.k} className="h-10 flex-row items-center gap-3">
          <View className={cn("h-2.5 w-2.5 rounded-full", r.tone)} />
          <Text className="w-14 text-[14px] font-semibold text-foreground">{r.label}</Text>
          <Text className="flex-1 text-[14px] text-muted-foreground" style={TNUM}>
            {r.span}
          </Text>
          <Text className="text-[14px] font-semibold text-foreground" style={TNUM}>
            {r.len}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- the sheet

function Skeleton() {
  return (
    <View className="items-center gap-3 py-2">
      <View className="h-4 w-28 rounded-full bg-muted" />
      <View className="h-12 w-44 rounded-[12px] bg-muted" />
      <View className="h-3 w-20 rounded-full bg-muted" />
      <View className="mt-3 h-14 w-full rounded-full bg-muted" />
      <View className="mt-2 h-10 w-full rounded-[12px] bg-muted" />
    </View>
  );
}

function StateHead({ s, now, size = 56 }: { s: ProtoState; now: number; size?: number }) {
  const phase = phaseOf(s.cache) ?? "out";
  const face = FACE[phase];
  const tone = useVar(face.tone, "#888");
  const run = running(s);
  return (
    <View className="items-center gap-1">
      <View className="flex-row items-center gap-1.5">
        <face.icon size={16} color={tone} weight="bold" />
        <Text className="text-[14px] font-semibold" style={{ color: tone }}>
          {face.label}
        </Text>
      </View>
      {run && phase !== "inactive" ? (
        <>
          <Text
            className="font-display font-bold text-foreground"
            style={[TNUM, { fontSize: size, lineHeight: size * 1.1, letterSpacing: -1.5 }]}
          >
            {fmtClock(now - run.start)}
          </Text>
          <Text className="text-[14px] text-muted-foreground" style={TNUM}>
            {phase === "break" ? `break since ${hhmm(run.start)}` : `since ${hhmm(run.start)}`}
          </Text>
        </>
      ) : phase !== "inactive" ? (
        <Text className="text-[14px] text-muted-foreground">
          {(s.cache?.sessions.length ?? 0) === 0 ? "Nothing recorded yet" : "Today"}
        </Text>
      ) : null}
    </View>
  );
}

/** A: the web widget, ported as is. */
function VariantA({
  s,
  now,
  onLink,
}: {
  s: ProtoState;
  now: number;
  onLink: (to: string) => void;
}) {
  const phase = phaseOf(s.cache);
  return (
    <View className="gap-4">
      <Notices s={s} onLink={onLink} />
      {phase !== "inactive" ? <StateHead s={s} now={now} /> : null}
      <Actions s={s} />
      <LocationLine s={s} />
      <DayTotals s={s} now={now} />
      <AttendanceLink onLink={onLink} />
    </View>
  );
}

/** B: the day on a timeline, with the actions pinned under it. Medium and large detents. */
function VariantB({
  s,
  now,
  onLink,
}: {
  s: ProtoState;
  now: number;
  onLink: (to: string) => void;
}) {
  const phase = phaseOf(s.cache) ?? "out";
  const face = FACE[phase];
  const tone = useVar(face.tone, "#888");
  const run = running(s);
  return (
    <View className="gap-4">
      <View className="flex-row items-end justify-between">
        <View className="gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <face.icon size={15} color={tone} weight="bold" />
            <Text className="text-[13.5px] font-semibold" style={{ color: tone }}>
              {face.label}
            </Text>
          </View>
          <Text
            className="font-display text-[40px] font-bold text-foreground"
            style={[TNUM, { letterSpacing: -1 }]}
          >
            {run && phase !== "inactive"
              ? fmtClock(now - run.start)
              : fmtDur(totals(s.cache, now).work)}
          </Text>
        </View>
        <Text className="pb-2 text-[13px] text-muted-foreground" style={TNUM}>
          {run && phase !== "inactive" ? `since ${hhmm(run.start)}` : "worked today"}
        </Text>
      </View>
      <Notices s={s} onLink={onLink} />
      <Actions s={s} />
      <LocationLine s={s} />
      <Timeline s={s} now={now} />
      <SessionRows s={s} now={now} />
      <DayTotals s={s} now={now} withRequired />
      <AttendanceLink onLink={onLink} />
    </View>
  );
}

/** C: a dial toward today's required time, one big action, the rest quiet. */
function VariantC({
  s,
  now,
  onLink,
}: {
  s: ProtoState;
  now: number;
  onLink: (to: string) => void;
}) {
  const phase = phaseOf(s.cache) ?? "out";
  const face = FACE[phase];
  const tone = useVar(face.tone, "#888");
  const track = useVar("--surface-2", "#eee");
  const t = totals(s.cache, now);
  const progress = Math.min(1, t.work / REQUIRED_MS);
  const R = 92;
  const C = 2 * Math.PI * R;
  const run = running(s);
  const off = !s.online;
  const busy = !!s.busy;
  const link = useVar("--primary", "#6a5ec6");

  const secondary =
    phase === "in"
      ? { label: "Take a break", do: () => act("break") }
      : phase === "break"
        ? { label: "Clock out instead", do: () => act("out") }
        : null;

  return (
    <View className="gap-4">
      <Notices s={s} onLink={onLink} />
      {phase !== "inactive" ? (
        <View className="items-center">
          <View style={{ width: 220, height: 220 }} className="items-center justify-center">
            <Svg width={220} height={220} style={{ position: "absolute" }}>
              <Circle cx={110} cy={110} r={R} stroke={track} strokeWidth={10} fill="none" />
              <Circle
                cx={110}
                cy={110}
                r={R}
                stroke={tone}
                strokeWidth={10}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${C * progress} ${C}`}
                transform="rotate(-90 110 110)"
              />
            </Svg>
            <Text className="text-[13px] font-semibold" style={{ color: tone }}>
              {face.label}
            </Text>
            <Text
              className="font-display text-[40px] font-bold text-foreground"
              style={[TNUM, { letterSpacing: -1 }]}
            >
              {run ? fmtClock(now - run.start) : fmtDur(t.work)}
            </Text>
            <Text className="text-[13px] text-muted-foreground" style={TNUM}>
              {fmtDur(Math.max(0, REQUIRED_MS - t.work))} left of 8h 00m
            </Text>
          </View>
        </View>
      ) : null}
      {phase === "out" && !s.conflictStartedAt ? (
        <Actions s={s} />
      ) : phase === "in" ? (
        <BigButton
          label="Clock out"
          busyLabel="Clocking out..."
          icon={SignOutIcon}
          kind="primary"
          busy={s.busy === "out"}
          disabled={off || busy}
          onPress={() => act("out")}
        />
      ) : phase === "break" ? (
        <BigButton
          label="End break"
          busyLabel="Ending..."
          icon={PlayIcon}
          kind="warm"
          busy={s.busy === "resume"}
          disabled={off || busy}
          onPress={() => act("resume")}
        />
      ) : null}
      {secondary ? (
        <Pressable
          onPress={secondary.do}
          disabled={off || busy}
          className="items-center py-1 active:opacity-70"
        >
          <Text
            className="text-[15px] font-semibold"
            style={{ color: link, opacity: off || busy ? 0.5 : 1 }}
          >
            {s.busy === "break" ? "Starting break..." : secondary.label}
          </Text>
        </Pressable>
      ) : null}
      <LocationLine s={s} />
      <View className="flex-row justify-around">
        <Text className="text-[13px] text-muted-foreground" style={TNUM}>
          Breaks {fmtDur(t.breaks)} of {fmtDur(BREAK_ALLOWANCE_MS)}
        </Text>
        <Pressable
          onPress={() => onLink("/my-attendance")}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text className="text-[13px] font-semibold" style={{ color: link }}>
            My attendance
          </Text>
          <CaretRightIcon size={12} color={link} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

export function ClockSheetBody({ onLink }: { onLink: (to: string) => void }) {
  const s = useProto();
  const now = useNow(1000);
  const loadingNow = s.loading || (!s.cache && s.online);
  let body: ReactNode;
  if (loadingNow) body = <Skeleton />;
  else if (!s.cache) body = <Notices s={s} onLink={onLink} />;
  else if (s.prefs.variant === "B") body = <VariantB s={s} now={now} onLink={onLink} />;
  else if (s.prefs.variant === "C") body = <VariantC s={s} now={now} onLink={onLink} />;
  else body = <VariantA s={s} now={now} onLink={onLink} />;
  return (
    <>
      {body}
      <FakePrompt />
    </>
  );
}

// ---------------------------------------------------------------- simulated iOS location prompt

const BLUE = "#0a84ff";
function PromptRow({
  label,
  onPress,
  bold,
}: {
  label: string;
  onPress: () => void;
  bold?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-11 items-center justify-center border-t active:opacity-60"
      style={{ borderColor: "#3a3a3c55" }}
    >
      <Text style={{ color: BLUE, fontSize: 17, fontWeight: bold ? "600" : "400" }}>{label}</Text>
    </Pressable>
  );
}

function FakePrompt() {
  const s = useProto();
  const [precise, setPrecise] = useState(true);
  return (
    <Modal transparent visible={s.prompt !== null} animationType="fade">
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#00000055" }}>
        <View
          className="w-[270px] overflow-hidden rounded-[14px]"
          style={{ backgroundColor: "#f2f2f7ee" }}
        >
          <View className="items-center gap-1.5 px-4 pt-5 pb-3">
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#000", textAlign: "center" }}>
              Allow &quot;Flexi Day&quot; to use your location?
            </Text>
            <Text style={{ fontSize: 13, color: "#000", textAlign: "center" }}>
              Flexi Day saves where you clock in and out when your organization records it.
            </Text>
            <Pressable
              onPress={() => setPrecise(!precise)}
              className="mt-2 h-24 w-full items-center justify-center rounded-[10px]"
              style={{ backgroundColor: "#d8e4d0" }}
            >
              <Text style={{ fontSize: 12, color: "#333" }}>(map)</Text>
              <View
                className="absolute top-2 left-2 rounded-full px-2 py-0.5"
                style={{ backgroundColor: "#ffffffcc" }}
              >
                <Text style={{ fontSize: 11, color: precise ? BLUE : "#666", fontWeight: "600" }}>
                  Precise: {precise ? "On" : "Off"}
                </Text>
              </View>
            </Pressable>
          </View>
          <PromptRow label="Allow Once" onPress={() => answerPrompt("once", precise)} />
          <PromptRow label="Allow While Using App" onPress={() => answerPrompt("while", precise)} />
          <PromptRow label="Don't Allow" onPress={() => answerPrompt("deny", precise)} bold />
        </View>
        <Text className="mt-2 text-[11px]" style={{ color: "#fff" }}>
          simulated iOS prompt
        </Text>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- haptic flash + switcher

export function HapticFlash() {
  const s = useProto();
  const now = useNow(250);
  const shown = s.haptic && now - s.haptic.at < 1600 ? s.haptic.label : null;
  if (!shown) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute top-2 self-center rounded-full px-3 py-1"
      style={{ backgroundColor: "#2a2140" }}
    >
      <Text style={mono}>haptic: {shown}</Text>
    </View>
  );
}

const mono = { fontFamily: "Menlo", fontSize: 11, color: "#f4f1ff" } as const;

function Chip({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3 py-1.5 active:opacity-80"
      style={{ backgroundColor: "#15131c" }}
    >
      <Text style={mono}>{text}</Text>
    </Pressable>
  );
}

const cycle = <T,>(list: readonly T[], cur: T) => list[(list.indexOf(cur) + 1) % list.length];

export function Switcher({ onOpen }: { onOpen: () => void }) {
  const s = useProto();
  const [open, setOpen] = useState(false);
  if (!__DEV__) return null;
  const i = Math.max(
    0,
    SCENARIOS.findIndex((x) => x.key === s.scenario)
  );
  const go = (d: number) =>
    loadScenario(SCENARIOS[(i + d + SCENARIOS.length) % SCENARIOS.length].key);
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 top-0 items-center pt-safe">
      <View className="mt-1 flex-row gap-1.5">
        <Chip text="‹" onPress={() => go(-1)} />
        <Chip text={`${open ? "x " : ""}${SCENARIOS[i].name}`} onPress={() => setOpen(!open)} />
        <Chip text="›" onPress={() => go(1)} />
      </View>
      {open ? (
        <View className="mt-1.5 flex-row flex-wrap justify-center gap-1.5 px-3">
          <Chip
            text={`sheet: ${s.prefs.variant}`}
            onPress={() => setPrefs({ variant: cycle(["A", "B", "C"] as const, s.prefs.variant) })}
          />
          <Chip
            text={`disc: ${s.prefs.disc}`}
            onPress={() =>
              setPrefs({ disc: cycle(["label", "inside", "capsule"] as const, s.prefs.disc) })
            }
          />
          <Chip
            text={`loc line: ${s.prefs.locLine}`}
            onPress={() =>
              setPrefs({ locLine: cycle(["line", "quiet"] as const, s.prefs.locLine) })
            }
          />
          <Chip
            text={`errors: ${s.prefs.errors}`}
            onPress={() =>
              setPrefs({ errors: cycle(["inline", "toast"] as const, s.prefs.errors) })
            }
          />
          <Chip text={s.online ? "online" : "offline"} onPress={() => set({ online: !s.online })} />
          <Chip
            text={`next fail: ${s.failNext}`}
            onPress={() =>
              set({
                failNext: cycle(["none", "network", "409", "402", "403"] as const, s.failNext),
              })
            }
          />
          <Chip
            text={`perm: ${s.perm}`}
            onPress={() =>
              set({
                perm: cycle(["undetermined", "granted", "approximate", "denied"] as const, s.perm),
              })
            }
          />
          <Chip
            text={`fix: ${s.fixSpeed}`}
            onPress={() => set({ fixSpeed: cycle(["fast", "slow", "never"] as const, s.fixSpeed) })}
          />
          <Chip
            text={`location: ${s.locationEnabled ? "org on" : "org off"}`}
            onPress={() => set({ locationEnabled: !s.locationEnabled })}
          />
          <Chip
            text={`server: ${s.prefs.latency} ms`}
            onPress={() => setPrefs({ latency: s.prefs.latency === 900 ? 4000 : 900 })}
          />
          <Chip text="web clocks in" onPress={webClockIn} />
          <Chip text="foreground (re-read)" onPress={() => reread("foreground")} />
          <Chip text="open sheet" onPress={onOpen} />
        </View>
      ) : null}
      {s.lastAction ? (
        <View className="mt-1.5 rounded-full px-3 py-1" style={{ backgroundColor: "#2a2140" }}>
          <Text style={mono}>{s.lastAction}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const proto = { get };
