// PROTOTYPE (T-35): a fake clock state machine for the clock sheet. No backend, no location, no
// haptics module: every outcome is simulated with timers and the switches on the pill. Throwaway.
import { useSyncExternalStore } from "react";

export type Phase = "out" | "in" | "break" | "inactive";
export type Perm = "undetermined" | "granted" | "approximate" | "denied";
export type Failure = "none" | "network" | "409" | "402" | "403";
export type FixSpeed = "fast" | "slow" | "never";
export type Span = { start: number; end: number | null; autoClosed?: boolean };
export type Session = Span & { breaks: Span[] };

export type Loc = {
  stage: "idle" | "asking" | "coarse" | "precise" | "done" | "skipped";
  end?: "IN" | "OUT";
  coarse?: number;
  precise?: number;
  approx?: boolean;
  startedAt?: number;
};

type Server = { sessions: Session[]; active: boolean; employmentEnded: boolean };

export type Prefs = {
  variant: "A" | "B" | "C";
  disc: "label" | "inside" | "capsule";
  locLine: "quiet" | "line";
  errors: "inline" | "toast";
  latency: number;
};

export type ProtoState = {
  prefs: Prefs;
  scenario: string;
  loading: boolean;
  online: boolean;
  server: Server;
  /** What the phone last read from `/current`. Only a re-read copies the server over it. */
  cache: Server | null;
  readAt: number | null;
  locationEnabled: boolean;
  noticeDismissed: boolean;
  perm: Perm;
  promptAnswer: "once" | "while" | "deny";
  precise: boolean;
  fixSpeed: FixSpeed;
  failNext: Failure;
  busy: null | "in" | "out" | "break" | "resume" | "reread";
  error: null | { kind: "network" | "refusal"; title: string; body: string; retry?: Action };
  conflictStartedAt: number | null;
  autoClosed: boolean;
  loc: Loc;
  prompt: null | "IN" | "OUT";
  haptic: { label: string; at: number } | null;
  lastAction: string | null;
};

export type Action = "in" | "out" | "break" | "resume";

const MIN = 60_000;
const at = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/** A morning session already closed, so the totals and timeline have something before now. */
const morning = (): Session => ({
  start: at(7, 58),
  end: at(11, 42),
  breaks: [{ start: at(9, 55), end: at(10, 12) }],
});

const openSince = (minsAgo: number, breaks: Span[] = []): Session => ({
  start: Date.now() - minsAgo * MIN,
  end: null,
  breaks,
});

const base = (): Omit<ProtoState, "prefs" | "scenario"> => ({
  loading: false,
  online: true,
  server: { sessions: [], active: true, employmentEnded: false },
  cache: null,
  readAt: null,
  locationEnabled: true,
  noticeDismissed: true,
  perm: "granted",
  promptAnswer: "while",
  precise: true,
  fixSpeed: "fast",
  failNext: "none",
  busy: null,
  error: null,
  conflictStartedAt: null,
  autoClosed: false,
  loc: { stage: "idle" },
  prompt: null,
  haptic: null,
  lastAction: null,
});

type Scenario = { key: string; name: string; make: () => Partial<ProtoState> };

const withServer = (s: Partial<Server>): Partial<ProtoState> => {
  const server = { sessions: [], active: true, employmentEnded: false, ...s };
  return { server, cache: clone(server), readAt: Date.now() };
};

export const SCENARIOS: Scenario[] = [
  { key: "out", name: "Out, nothing yet", make: () => withServer({}) },
  { key: "out2", name: "Out, back from lunch", make: () => withServer({ sessions: [morning()] }) },
  {
    key: "in",
    name: "In, timer running",
    make: () => withServer({ sessions: [morning(), openSince(107)] }),
  },
  {
    key: "break",
    name: "On break",
    make: () =>
      withServer({
        sessions: [openSince(236, [{ start: Date.now() - 14 * MIN, end: null }])],
      }),
  },
  { key: "inactive", name: "Inactive (lapsed)", make: () => withServer({ active: false }) },
  {
    key: "inactive-open",
    name: "Inactive, session still open",
    make: () => withServer({ active: false, sessions: [openSince(190)] }),
  },
  {
    key: "first",
    name: "First clock: notice + prompt",
    make: () => ({ ...withServer({}), noticeDismissed: false, perm: "undetermined" }),
  },
  {
    key: "denied",
    name: "Location denied",
    make: () => ({ ...withServer({}), perm: "denied" }),
  },
  {
    key: "approx",
    name: "Approximate location",
    make: () => ({ ...withServer({}), perm: "approximate" }),
  },
  {
    key: "auto",
    name: "Auto-closed yesterday",
    make: () => ({ ...withServer({}), autoClosed: true }),
  },
  {
    key: "web",
    name: "Stale: clocked in on the web",
    // The server has a session the phone has not read yet. Tapping Clock in hits a 409.
    make: () => {
      const server = { sessions: [openSince(38)], active: true, employmentEnded: false };
      return {
        server,
        cache: { sessions: [], active: true, employmentEnded: false },
        readAt: Date.now() - 52 * MIN,
      };
    },
  },
  {
    key: "offline",
    name: "Offline (last read kept)",
    make: () => ({
      ...withServer({ sessions: [morning(), openSince(64)] }),
      online: false,
      readAt: Date.now() - 6 * MIN,
    }),
  },
  {
    key: "offline-cold",
    name: "Offline, cold start",
    make: () => ({ ...withServer({}), cache: null, readAt: null, online: false }),
  },
  {
    key: "neterr",
    name: "Clock-in fails: no signal",
    make: () => ({ ...withServer({}), failNext: "network" }),
  },
  {
    key: "402",
    name: "Clock-in refused: plan lapsed",
    make: () => ({ ...withServer({}), failNext: "402" }),
  },
  {
    key: "loading",
    name: "Loading (cold start)",
    make: () => ({ ...withServer({}), cache: null, readAt: null, loading: true }),
  },
];

// ---------------------------------------------------------------- store

let state: ProtoState = {
  prefs: { variant: "A", disc: "label", locLine: "line", errors: "inline", latency: 900 },
  scenario: "in",
  ...base(),
  ...SCENARIOS[2].make(),
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const set = (patch: Partial<ProtoState> | ((s: ProtoState) => Partial<ProtoState>)) => {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  emit();
};
export const get = () => state;
export const useProto = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state
  );

let timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

export function loadScenario(key: string) {
  clearTimers();
  const s = SCENARIOS.find((x) => x.key === key) ?? SCENARIOS[2];
  state = { prefs: state.prefs, scenario: s.key, ...base(), ...s.make() };
  emit();
  if (state.loading) later(1400, () => reread("cold start"));
}

export const setPrefs = (patch: Partial<Prefs>) =>
  set((s) => ({ prefs: { ...s.prefs, ...patch } }));

function clone(s: Server): Server {
  return JSON.parse(JSON.stringify(s)) as Server;
}

export function haptic(label: string) {
  set({ haptic: { label, at: Date.now() } });
}

/** A re-read of `/current`: the only way the phone learns what the server holds. */
export function reread(why: string) {
  const s = get();
  if (!s.online) {
    set({ loading: false, lastAction: `re-read skipped (${why}): offline` });
    return;
  }
  set({ busy: s.busy ?? "reread" });
  later(450, () =>
    set((cur) => ({
      cache: clone(cur.server),
      readAt: Date.now(),
      loading: false,
      busy: cur.busy === "reread" ? null : cur.busy,
      lastAction: `GET /current (${why})`,
    }))
  );
}

// ---------------------------------------------------------------- derived

export function phaseOf(s: Server | null): Phase | null {
  if (!s) return null;
  if (!s.active || s.employmentEnded) return "inactive";
  const open = s.sessions.find((x) => x.end === null);
  if (!open) return "out";
  return open.breaks.some((b) => b.end === null) ? "break" : "in";
}

export const openSessionOf = (s: Server | null) => s?.sessions.find((x) => x.end === null) ?? null;
export const openBreakOf = (s: Server | null) =>
  openSessionOf(s)?.breaks.find((b) => b.end === null) ?? null;

const spanMs = (sp: Span, now: number) => (sp.end ?? now) - sp.start;

export function totals(s: Server | null, now: number) {
  const sessions = s?.sessions ?? [];
  const presence = sessions.reduce((a, x) => a + spanMs(x, now), 0);
  const breaks = sessions.reduce((a, x) => a + x.breaks.reduce((b, y) => b + spanMs(y, now), 0), 0);
  return { presence, breaks, work: presence - breaks, count: sessions.length };
}

export const REQUIRED_MS = 8 * 60 * MIN;
export const BREAK_ALLOWANCE_MS = 30 * MIN;

export function fmtDur(ms: number) {
  const m = Math.max(0, Math.floor(ms / MIN));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function fmtShort(ms: number) {
  const m = Math.max(0, Math.floor(ms / MIN));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------- the four writes

const LABEL: Record<Action, string> = {
  in: "POST /clock-in",
  out: "POST /clock-out",
  break: "POST /breaks/start",
  resume: "POST /breaks/end",
};

export function act(action: Action) {
  const s = get();
  if (s.busy || !s.online) return;
  haptic("impactMedium (tap)");
  set({ busy: action, error: null, conflictStartedAt: null, lastAction: LABEL[action] });
  later(get().prefs.latency, () => settle(action));
}

function settle(action: Action) {
  const s = get();
  const fail = s.failNext;
  if (fail === "network") {
    haptic("notificationError");
    set({
      busy: null,
      failNext: "none",
      error: {
        kind: "network",
        title: "Couldn't reach the server",
        body: "Your clock didn't change. Check your signal and try again.",
        retry: action,
      },
      lastAction: `${LABEL[action]} → network error`,
    });
    return;
  }
  if (fail === "402" || fail === "403") {
    haptic("notificationWarning");
    const server = { ...s.server, active: fail === "402" ? false : s.server.active };
    if (fail === "403") server.employmentEnded = true;
    set({
      busy: null,
      failNext: "none",
      server,
      error: {
        kind: "refusal",
        title: "Could not update your clock",
        body:
          fail === "402"
            ? "Attendance is not active for your organization."
            : "Your employment here has ended, so the clock is closed.",
      },
      lastAction: `${LABEL[action]} → ${fail}`,
    });
    reread(`after ${fail}`);
    return;
  }

  const server = clone(s.server);
  const open = server.sessions.find((x) => x.end === null);
  const now = Date.now();

  // The server's own 409s: acting on a stale read.
  if (action === "in" && open) {
    haptic("notificationWarning");
    set({
      busy: null,
      conflictStartedAt: open.start,
      lastAction: `${LABEL[action]} → 409 SESSION_ALREADY_OPEN`,
    });
    reread("after 409");
    return;
  }
  if ((action === "out" || action === "break") && !open) {
    haptic("notificationWarning");
    set({
      busy: null,
      error: {
        kind: "refusal",
        title: "Could not update your clock",
        body: "You are not clocked in.",
      },
      lastAction: `${LABEL[action]} → 409 NO_OPEN_SESSION`,
    });
    reread("after 409");
    return;
  }
  if (fail === "409") {
    haptic("notificationWarning");
    set({
      busy: null,
      failNext: "none",
      error: {
        kind: "refusal",
        title: "Could not update your clock",
        body: "A break is already running.",
      },
      lastAction: `${LABEL[action]} → 409 BREAK_ALREADY_OPEN`,
    });
    reread("after 409");
    return;
  }

  if (action === "in") server.sessions.push({ start: now, end: null, breaks: [] });
  if (action === "out" && open) {
    open.end = now;
    open.breaks.forEach((b) => (b.end ??= now));
  }
  if (action === "break" && open) open.breaks.push({ start: now, end: null });
  if (action === "resume" && open) {
    const b = open.breaks.find((x) => x.end === null);
    if (b) b.end = now;
  }

  set({ server, busy: "reread", lastAction: `${LABEL[action]} → 201` });
  // No optimistic write: the button stays busy until the re-read lands.
  later(450, () => {
    set((cur) => ({ cache: clone(cur.server), readAt: Date.now(), busy: null }));
    haptic("notificationSuccess");
    if ((action === "in" || action === "out") && get().locationEnabled) {
      startLocation(action === "in" ? "IN" : "OUT");
    }
  });
}

export function retry() {
  const r = get().error?.retry;
  set({ error: null });
  if (r) act(r);
}

// ---------------------------------------------------------------- location

const PASSES: Record<FixSpeed, { coarse: number | null; precise: number | null }> = {
  fast: { coarse: 700, precise: 3200 },
  slow: { coarse: 5200, precise: 17000 },
  never: { coarse: null, precise: null },
};

function startLocation(end: "IN" | "OUT") {
  const s = get();
  if (s.perm === "denied") {
    set({ loc: { stage: "skipped", end }, lastAction: "location: denied, skipped silently" });
    return;
  }
  if (s.perm === "undetermined") {
    set({ prompt: end, loc: { stage: "asking", end } });
    return;
  }
  runPasses(end);
}

export function answerPrompt(answer: "once" | "while" | "deny", precise: boolean) {
  const end = get().prompt ?? "IN";
  if (answer === "deny") {
    set({ prompt: null, perm: "denied", loc: { stage: "skipped", end } });
    return;
  }
  set({ prompt: null, perm: precise ? "granted" : "approximate", precise });
  runPasses(end);
  // Allow Once reverts to not-determined once the app is no longer in use.
  if (answer === "once") later(100, () => set({ lastAction: "Allow Once: asks again next clock" }));
  if (answer === "once") onceRevert = true;
}
let onceRevert = false;

function runPasses(end: "IN" | "OUT") {
  const s = get();
  const approx = s.perm === "approximate";
  const speed = PASSES[s.fixSpeed];
  const startedAt = Date.now();
  set({ loc: { stage: "coarse", end, approx, startedAt } });
  const coarseMs = speed.coarse ?? 8000;
  later(coarseMs, () => {
    const coarse = speed.coarse === null ? undefined : approx ? 3100 : 65;
    set((cur) => ({
      loc: { ...cur.loc, stage: "precise", coarse },
      lastAction:
        coarse === undefined
          ? "coarse pass: timed out at 8 s"
          : `POST /sessions/:id/location {end:${end}, accuracy:${coarse}}`,
    }));
    const preciseMs = speed.precise === null ? 30000 : speed.precise - coarseMs;
    later(Math.max(300, preciseMs), () => {
      const precise = speed.precise === null ? undefined : approx ? 3100 : 9;
      set((cur) => ({
        loc: { ...cur.loc, stage: "done", precise },
        lastAction:
          precise === undefined
            ? "precise pass: timed out at 30 s"
            : `POST /sessions/:id/location {end:${end}, accuracy:${precise}}`,
      }));
      if (onceRevert) {
        onceRevert = false;
        set({ perm: "undetermined" });
      }
    });
  });
}

export function dismissNotice() {
  haptic("selection");
  set({
    noticeDismissed: true,
    lastAction: "PUT /me/settings {attendanceLocationNoticeDismissed:true}",
  });
}

/** Someone clocks in on the web: the server moves, the phone does not know yet. */
export function webClockIn() {
  set((cur) => {
    const server = clone(cur.server);
    if (!server.sessions.some((x) => x.end === null)) {
      server.sessions.push({ start: Date.now() - 4 * MIN, end: null, breaks: [] });
    }
    return { server, lastAction: "web: clocked in (phone not told)" };
  });
}
