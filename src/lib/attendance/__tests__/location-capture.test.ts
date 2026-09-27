import {
  HIDDEN,
  captureLocation,
  formatRadius,
  locationNoticeShown,
  nextLocationStatus,
  type LocationDevice,
  type LocationEvent,
  type LocationFix,
  type Reading,
} from "../location-capture";
import { attendance, session } from "@/test-support/attendance";

const HERE: Reading = { latitude: 50.0875, longitude: 14.4213, accuracy: 65 };
const SHARP: Reading = { latitude: 50.08751, longitude: 14.42131, accuracy: 5 };

const never = <T>() => new Promise<T>(() => undefined);

function device(overrides: Partial<LocationDevice> = {}): LocationDevice {
  return {
    servicesEnabled: jest.fn(async () => true),
    requestPermission: jest.fn(async () => ({ granted: true, reduced: false })),
    lastKnown: jest.fn(async () => null),
    current: jest.fn(async (accuracy) => (accuracy === "balanced" ? HERE : SHARP)),
    ...overrides,
  };
}

function run(
  located: LocationDevice,
  {
    end = "IN" as const,
    send = jest.fn(async (fix: LocationFix) => fix.accuracy),
  }: { end?: "IN" | "OUT"; send?: jest.Mock } = {}
) {
  const events: LocationEvent[] = [];
  let leave = () => undefined as void;
  const done = captureLocation({
    end,
    device: located,
    send,
    onEvent: (event) => events.push(event),
    onLeave: (listener) => {
      leave = listener;
      return () => undefined;
    },
  });
  return { done, events, send, leave: () => leave() };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("captureLocation", () => {
  it("does nothing and sends nothing when the person declines", async () => {
    const located = device({
      requestPermission: jest.fn(async () => ({ granted: false, reduced: false })),
    });
    const { done, events, send } = run(located);
    await done;

    expect(located.current).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(events).toEqual([{ kind: "done", end: "IN" }]);
  });

  it("sends a coarse fix and then a precise one, each as it arrives", async () => {
    const { done, events, send } = run(device(), { end: "OUT" });
    await done;

    expect(send.mock.calls.map(([fix]) => fix)).toEqual([
      { end: "OUT", latitude: 50.0875, longitude: 14.4213, accuracy: 65 },
      { end: "OUT", latitude: 50.08751, longitude: 14.42131, accuracy: 5 },
    ]);
    expect(events).toEqual([
      { kind: "finding", end: "OUT" },
      { kind: "saved", end: "OUT", pass: "coarse", accuracy: 65, reduced: false },
      { kind: "saved", end: "OUT", pass: "precise", accuracy: 5, reduced: false },
      { kind: "done", end: "OUT" },
    ]);
  });

  it("reports the accuracy the backend holds, not the one it was sent", async () => {
    const send = jest.fn(async () => 65);
    const { done, events } = run(device(), { send });
    await done;

    expect(events).toContainEqual({
      kind: "saved",
      end: "IN",
      pass: "precise",
      accuracy: 65,
      reduced: false,
    });
  });

  it("takes a last known position from the past minute over a new Balanced reading", async () => {
    const located = device({ lastKnown: jest.fn(async () => ({ ...HERE, accuracy: 30 })) });
    const { done, send } = run(located);
    await done;

    expect(located.lastKnown).toHaveBeenCalledWith(60_000);
    expect(located.current).not.toHaveBeenCalledWith("balanced");
    expect(send.mock.calls[0][0].accuracy).toBe(30);
  });

  it("gives the coarse pass 8 seconds and then moves on to the precise one", async () => {
    const located = device({
      current: jest.fn((accuracy) => (accuracy === "balanced" ? never<Reading>() : never())),
    });
    const { events, send } = run(located);

    await jest.advanceTimersByTimeAsync(7_999);
    expect(located.current).not.toHaveBeenCalledWith("highest");

    await jest.advanceTimersByTimeAsync(1);
    expect(located.current).toHaveBeenCalledWith("highest");
    expect(send).not.toHaveBeenCalled();
    expect(events).toEqual([{ kind: "finding", end: "IN" }]);
  });

  it("gives up on the precise pass after 30 seconds, keeping the coarse fix", async () => {
    const located = device({
      current: jest.fn(async (accuracy) => (accuracy === "balanced" ? HERE : never<Reading>())),
    });
    const { done, events, send } = run(located);

    await jest.advanceTimersByTimeAsync(29_999);
    expect(events.at(-1)?.kind).toBe("saved");

    await jest.advanceTimersByTimeAsync(1);
    await done;
    expect(send).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.kind)).toEqual(["finding", "saved", "done"]);
  });

  it("sends an approximate fix like a coarse one and stops there", async () => {
    const located = device({
      requestPermission: jest.fn(async () => ({ granted: true, reduced: true })),
      current: jest.fn(async () => ({ ...HERE, accuracy: 4_200 })),
    });
    const { done, events, send } = run(located);
    await done;

    expect(send).toHaveBeenCalledTimes(1);
    expect(located.current).not.toHaveBeenCalledWith("highest");
    expect(events).toEqual([
      { kind: "finding", end: "IN" },
      { kind: "saved", end: "IN", pass: "coarse", accuracy: 4_200, reduced: true },
      { kind: "done", end: "IN" },
    ]);
  });

  it("drops a coarse reading that arrives after its 8 seconds and still runs the precise pass", async () => {
    let late: (reading: Reading) => void = () => undefined;
    const located = device({
      current: jest.fn((accuracy) =>
        accuracy === "balanced"
          ? new Promise<Reading>((resolve) => (late = resolve))
          : never<Reading>()
      ),
    });
    const { events, send } = run(located);

    await jest.advanceTimersByTimeAsync(8_000);
    expect(located.current).toHaveBeenCalledWith("highest");
    late(HERE);
    await jest.advanceTimersByTimeAsync(0);

    expect(send).not.toHaveBeenCalled();
    expect(events).toEqual([{ kind: "finding", end: "IN" }]);
  });

  it("ends the capture without sending when the person leaves the app during the coarse pass", async () => {
    let answer: (reading: Reading) => void = () => undefined;
    const located = device({
      current: jest.fn((accuracy) =>
        accuracy === "balanced"
          ? new Promise<Reading>((resolve) => (answer = resolve))
          : Promise.resolve(SHARP)
      ),
    });
    const { done, events, send, leave } = run(located);

    await jest.advanceTimersByTimeAsync(2_000);
    leave();
    answer(HERE);
    await done;

    expect(send).not.toHaveBeenCalled();
    expect(located.current).not.toHaveBeenCalledWith("highest");
    expect(events).toEqual([
      { kind: "finding", end: "IN" },
      { kind: "done", end: "IN" },
    ]);
  });

  it("loses the precise pass when the person leaves the app during it", async () => {
    let answer: (reading: Reading) => void = () => undefined;
    const located = device({
      current: jest.fn((accuracy) =>
        accuracy === "balanced"
          ? Promise.resolve(HERE)
          : new Promise<Reading>((resolve) => (answer = resolve))
      ),
    });
    const { done, events, send, leave } = run(located);

    await jest.advanceTimersByTimeAsync(3_000);
    leave();
    answer(SHARP);
    await done;

    expect(send).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.kind)).toEqual(["finding", "saved", "done"]);
  });

  it("carries on to the precise pass when the coarse fix does not reach the backend", async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(5);
    const { done, events } = run(device(), { send });
    await done;

    expect(send).toHaveBeenCalledTimes(2);
    expect(events.map((event) => event.kind)).toEqual(["finding", "saved", "done"]);
  });

  it("does not count a fix the backend answered without coordinates as saved", async () => {
    const { done, events } = run(device(), { send: jest.fn(async () => null) });
    await done;
    expect(events.map((event) => event.kind)).toEqual(["finding", "done"]);
  });

  it("never sends a reading without a usable accuracy", async () => {
    const located = device({
      current: jest.fn(async (accuracy) =>
        accuracy === "balanced" ? { ...HERE, accuracy: null } : { ...SHARP, latitude: NaN }
      ),
    });
    const { done, send } = run(located);
    await done;
    expect(send).not.toHaveBeenCalled();
  });

  it("asks nothing when Location Services are off", async () => {
    const located = device({ servicesEnabled: jest.fn(async () => false) });
    const { done, events } = run(located);
    await done;

    expect(located.requestPermission).not.toHaveBeenCalled();
    expect(events).toEqual([{ kind: "done", end: "IN" }]);
  });

  it("resolves quietly when asking for permission fails", async () => {
    const located = device({
      requestPermission: jest.fn(async () => {
        throw new Error("ERR_LOCATION_INFO_PLIST");
      }),
    });
    const { done, events } = run(located);

    await expect(done).resolves.toBeUndefined();
    expect(events).toEqual([{ kind: "done", end: "IN" }]);
  });

  it("says nothing was saved when both passes time out", async () => {
    const located = device({ current: jest.fn(() => never<Reading>()) });
    const { done, events, send } = run(located);

    await jest.advanceTimersByTimeAsync(38_000);
    await done;
    expect(send).not.toHaveBeenCalled();
    expect(events).toEqual([
      { kind: "finding", end: "IN" },
      { kind: "done", end: "IN" },
    ]);
  });
});

describe("nextLocationStatus", () => {
  const play = (events: LocationEvent[]) => events.reduce(nextLocationStatus, HIDDEN);
  const coarse = (accuracy: number, reduced = false): LocationEvent => ({
    kind: "saved",
    end: "IN",
    pass: "coarse",
    accuracy,
    reduced,
  });

  it("shows nothing until permission is granted", () => {
    expect(play([{ kind: "done", end: "IN" }])).toEqual({ kind: "hidden" });
  });

  it("is finding once the passes start", () => {
    expect(play([{ kind: "finding", end: "IN" }])).toEqual({ kind: "finding" });
  });

  it("is sharpening with the coarse accuracy after the coarse fix", () => {
    expect(play([{ kind: "finding", end: "IN" }, coarse(65)])).toEqual({
      kind: "sharpening",
      accuracy: 65,
    });
  });

  it("settles on the precise accuracy for that end", () => {
    expect(
      play([
        { kind: "finding", end: "OUT" },
        { kind: "saved", end: "OUT", pass: "coarse", accuracy: 65, reduced: false },
        { kind: "saved", end: "OUT", pass: "precise", accuracy: 5, reduced: false },
        { kind: "done", end: "OUT" },
      ])
    ).toEqual({ kind: "saved", end: "OUT", accuracy: 5 });
  });

  it("settles on the coarse accuracy when the precise pass brings nothing", () => {
    expect(play([{ kind: "finding", end: "IN" }, coarse(65), { kind: "done", end: "IN" }])).toEqual(
      { kind: "saved", end: "IN", accuracy: 65 }
    );
  });

  it("says approximate, without a radius, for a fix with Precise off", () => {
    expect(
      play([{ kind: "finding", end: "IN" }, coarse(4_200, true), { kind: "done", end: "IN" }])
    ).toEqual({ kind: "approximate" });
  });

  it("disappears when nothing was saved", () => {
    expect(
      play([
        { kind: "finding", end: "IN" },
        { kind: "done", end: "IN" },
      ])
    ).toEqual({
      kind: "hidden",
    });
  });
});

describe("locationNoticeShown", () => {
  const settings = (dismissed: boolean) => ({ attendanceLocationNoticeDismissed: dismissed });
  const recording = attendance({ locationEnabled: true });

  it("shows while location is on and the notice was never dismissed", () => {
    expect(locationNoticeShown(recording, settings(false))).toBe(true);
  });

  it("stays hidden until the settings read answers", () => {
    expect(locationNoticeShown(recording, undefined)).toBe(false);
  });

  it("stays hidden once dismissed, here or on the web", () => {
    expect(locationNoticeShown(recording, settings(true))).toBe(false);
  });

  it("stays hidden while the organization does not record location", () => {
    expect(locationNoticeShown(attendance(), settings(false))).toBe(false);
  });

  it("stays hidden while the clock is locked, with a session left open or not", () => {
    const paused = attendance({ locationEnabled: true, active: false });
    const stranded = { ...paused, openSession: session(), sessions: [session()] };
    const ended = attendance({ locationEnabled: true, employmentEnded: true });
    expect(locationNoticeShown(paused, settings(false))).toBe(false);
    expect(locationNoticeShown(stranded, settings(false))).toBe(false);
    expect(locationNoticeShown(ended, settings(false))).toBe(false);
  });

  it("stays hidden with no clock to show", () => {
    expect(locationNoticeShown(null, settings(false))).toBe(false);
  });
});

describe("formatRadius", () => {
  it("returns whole metres, kept on one line with their unit", () => {
    expect(formatRadius(64.6, "en-GB")).toBe("65\u00a0m");
  });

  it("returns kilometres to one decimal from a kilometre up, in the reader's locale", () => {
    expect(formatRadius(1_540, "en-GB")).toBe("1.5\u00a0km");
    expect(formatRadius(1_540, "cs-CZ")).toBe("1,5\u00a0km");
  });

  it("returns kilometres for a radius that rounds up to one", () => {
    expect(formatRadius(999.6, "en-GB")).toBe("1\u00a0km");
  });
});
