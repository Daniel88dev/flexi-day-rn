import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { CorrectionSheet } from "@/components/attendance/correction-sheet";
import { TranslationProvider } from "@/i18n/use-translation";
import type { AttendanceEvent, AttendanceSession, AttendanceState } from "@/lib/attendance";
import { attendance, attendanceMonth, pause, session } from "@/test-support/attendance";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockGuard = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("@/components/attendance/discard-guard", () => ({
  useDiscardGuard: (dirty: boolean) => mockGuard(dirty),
}));
jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = jest.requireActual("react-native");
  return function DateTimePicker(props: {
    testID: string;
    value: Date;
    onValueChange: (event: unknown, date: Date) => void;
  }) {
    return (
      <View
        testID={props.testID}
        onValueChange={props.onValueChange}
        accessibilityValue={{ text: props.value.toTimeString().slice(0, 5) }}
      />
    );
  };
});

const ORG = "org-1";
const DAY = "2026-09-24";
const reply = (status: number, body: unknown) => ({ status, json: async () => body });

// 08:00 to 16:00 in Prague, with a lunch from 12:00 to 12:30.
const lunch = pause({
  id: "lunch",
  sessionId: "s1",
  startedAt: "2026-09-24T10:00:00.000Z",
  endedAt: "2026-09-24T10:30:00.000Z",
  open: false,
});
const past = session({
  id: "s1",
  businessDate: DAY,
  startedAt: "2026-09-24T06:00:00.000Z",
  endedAt: "2026-09-24T14:00:00.000Z",
  closedBy: "USER",
  open: false,
  breaks: [lunch],
});

let current: AttendanceState;
let daySessions: AttendanceSession[];
let events: AttendanceEvent[];
let write: (method: string, path: string, body: unknown) => Promise<unknown>;

function serve() {
  mockFetch.mockImplementation(async (url: string, init: { method?: string; body?: string }) => {
    const path = new URL(url).pathname;
    if (init.method && init.method !== "GET") {
      return write(init.method, path, init.body ? JSON.parse(init.body) : undefined);
    }
    if (path === "/api/attendance/current") return reply(200, current);
    if (path === "/api/attendance/day")
      return reply(200, { organizationId: ORG, timezone: "Europe/Prague", sessions: daySessions });
    if (path === "/api/attendance/month") return reply(200, attendanceMonth(2026, 9));
    if (path === "/api/attendance/sessions/s1/events")
      return reply(200, { sessionId: "s1", events });
    return reply(404, {});
  });
}

const writes = () =>
  mockFetch.mock.calls
    .filter(([, init]) => init.method && init.method !== "GET")
    .map(([url, init]) => `${init.method} ${new URL(url).pathname}`);

const onClose = jest.fn();
const onOpenClock = jest.fn();

async function renderSheet(businessDate = DAY, viewerId: string | null = "me") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <TranslationProvider>
      <QueryClientProvider client={client}>
        <CorrectionSheet
          sessionId="s1"
          businessDate={businessDate}
          viewerId={viewerId}
          onClose={onClose}
          onOpenClock={onOpenClock}
        />
      </QueryClientProvider>
    </TranslationProvider>
  );
  await screen.findByTestId("correction-start");
  return client;
}

const setTime = (testID: string, hours: number, minutes: number) =>
  fireEvent(
    screen.getByTestId(testID),
    "valueChange",
    { type: "set" },
    new Date(2026, 8, 24, hours, minutes)
  );

const saveButton = () => screen.getByTestId("correction-save");

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  // Sunday 27 September 2026, 18:19 in Prague.
  jest.useFakeTimers({
    now: new Date("2026-09-27T16:19:00Z"),
    doNotFake: ["setImmediate", "nextTick"],
  });
  jest.clearAllMocks();
  current = attendance({
    organizationId: ORG,
    businessDate: "2026-09-27",
    selfService: { enabled: true, days: 7 },
  });
  daySessions = [past];
  events = [];
  write = async () => reply(200, past);
  serve();
});

afterEach(() => jest.useRealTimers());

describe("CorrectionSheet", () => {
  it("opens on the session's times with Save disabled until something changes", async () => {
    await renderSheet();

    expect(screen.getByTestId("correction-start")).toHaveAccessibilityValue({ text: "08:00" });
    expect(screen.getByTestId("correction-end")).toHaveAccessibilityValue({ text: "16:00" });
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByTestId("correction-start-was")).toBeNull();

    await setTime("correction-start", 7, 45);

    expect(saveButton()).toBeEnabled();
    expect(screen.getByTestId("correction-start-was")).toHaveTextContent("Was 08:00");
    expect(mockGuard).toHaveBeenLastCalledWith(true);
  });

  it("warns on a day that has passed that the save flags the session", async () => {
    await renderSheet();

    expect(screen.getByTestId("correction-past-day")).toHaveTextContent(
      "This day has passed. Once you save, your admin sees the session marked as changed after the day until they check it."
    );
  });

  it("says a swept end was set by the sweep", async () => {
    daySessions = [session({ ...past, closedBy: "SWEEP" })];
    await renderSheet();

    expect(screen.getByTestId("correction-end-was")).toHaveTextContent("Set by the sweep");
  });

  it("holds a removed break, struck through with Undo, and writes nothing until Save", async () => {
    await renderSheet();

    await fireEvent.press(screen.getByTestId("correction-break-1-remove"));

    expect(screen.getByTestId("correction-break-1-removed")).toHaveTextContent(
      /12:00 - 12:30.*Removed when you save/
    );
    expect(saveButton()).toBeEnabled();
    expect(writes()).toEqual([]);

    await fireEvent.press(screen.getByTestId("correction-break-1-undo"));

    expect(screen.queryByTestId("correction-break-1-removed")).toBeNull();
    expect(screen.getByTestId("correction-break-1-start")).toBeTruthy();
    expect(saveButton()).toBeDisabled();
  });

  it("saves in one go: the removed break, then the moved end, then the added break", async () => {
    await renderSheet();
    await fireEvent.press(screen.getByTestId("correction-break-1-remove"));
    await setTime("correction-end", 17, 0);
    await fireEvent.press(screen.getByTestId("correction-add-break"));
    await fireEvent.press(screen.getByTestId("correction-break-2-start-set"));
    await setTime("correction-break-2-start", 13, 0);
    await fireEvent.press(screen.getByTestId("correction-break-2-end-set"));
    await setTime("correction-break-2-end", 13, 20);

    await fireEvent.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(writes()).toEqual([
      "DELETE /api/attendance/breaks/lunch",
      "PATCH /api/attendance/sessions/s1",
      "POST /api/attendance/sessions/s1/breaks",
    ]);
  });

  it("turns Save into Retry after no answer, and the retry does not add a break twice", async () => {
    let posts = 0;
    write = async (method, path, body) => {
      if (method === "POST") {
        posts += 1;
        if (posts === 1) {
          const span = body as { startedAt: string; endedAt: string };
          const added = pause({ id: "srv-1", ...span, open: false });
          daySessions = [session({ ...past, breaks: [lunch, added] })];
          return reply(201, daySessions[0]);
        }
        if (posts === 2) throw new TypeError("Network request failed");
      }
      return reply(200, daySessions[0]);
    };
    await renderSheet();
    await fireEvent.press(screen.getByTestId("correction-add-break"));
    await fireEvent.press(screen.getByTestId("correction-break-2-start-set"));
    await setTime("correction-break-2-start", 13, 0);
    await fireEvent.press(screen.getByTestId("correction-break-2-end-set"));
    await setTime("correction-break-2-end", 13, 10);
    await fireEvent.press(screen.getByTestId("correction-add-break"));
    await fireEvent.press(screen.getByTestId("correction-break-3-start-set"));
    await setTime("correction-break-3-start", 14, 0);
    await fireEvent.press(screen.getByTestId("correction-break-3-end-set"));
    await setTime("correction-break-3-end", 14, 10);

    await fireEvent.press(saveButton());

    expect(await screen.findByTestId("correction-unreachable")).toBeTruthy();
    expect(saveButton()).toHaveTextContent("Retry");
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(writes()).toEqual([
      "POST /api/attendance/sessions/s1/breaks",
      "POST /api/attendance/sessions/s1/breaks",
      "POST /api/attendance/sessions/s1/breaks",
    ]);
    const bodies = mockFetch.mock.calls
      .filter(([, init]) => init.method === "POST")
      .map(([, init]) => JSON.parse(init.body).startedAt);
    expect(bodies).toEqual([
      "2026-09-24T11:00:00.000Z",
      "2026-09-24T12:00:00.000Z",
      "2026-09-24T12:00:00.000Z",
    ]);
  });

  it("shows a refusal inline in the web's words", async () => {
    write = async () =>
      reply(409, {
        errors: [{ message: "Overlaps", context: { reason: "SESSION_OVERLAPS" } }],
      });
    await renderSheet();
    await setTime("correction-end", 17, 0);

    await fireEvent.press(saveButton());

    expect(await screen.findByTestId("correction-refused")).toHaveTextContent(
      "Another session already covers that time."
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps Save disabled with the window's notice once the day is outside it", async () => {
    current = attendance({
      organizationId: ORG,
      businessDate: "2026-09-27",
      selfService: { enabled: true, days: 1 },
    });
    await renderSheet();
    await setTime("correction-end", 17, 0);

    expect(screen.getByTestId("correction-closed")).toHaveTextContent(
      "Only an admin can change a day this old. Ask a group admin, or an organization admin."
    );
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByTestId("correction-past-day")).toBeNull();
  });

  it("lists the session's history and takes the Entered by mark from it", async () => {
    daySessions = [session({ ...past, origin: "ENTERED", enteredByUserId: "me" })];
    events = [
      {
        id: "e1",
        sessionId: "s1",
        eventType: "SESSION_CREATED",
        user: { id: "me", name: "Dana Novak" },
        before: null,
        after: { startedAt: past.startedAt, endedAt: past.endedAt },
        createdAt: "2026-09-25T07:00:00.000Z",
      },
    ];
    await renderSheet();

    expect(await screen.findByText("Entered by Dana Novak")).toBeTruthy();
    expect(screen.getByTestId("correction-history")).toHaveTextContent(
      /Session entered, 08:00 to 16:00\. Dana Novak/
    );
  });
});

describe("CorrectionSheet, a session still running", () => {
  const running = session({
    id: "s1",
    businessDate: "2026-09-27",
    startedAt: "2026-09-27T06:00:00.000Z",
    endedAt: null,
    open: true,
    breaks: [
      pause({
        id: "lunch",
        startedAt: "2026-09-27T10:00:00.000Z",
        endedAt: "2026-09-27T10:30:00.000Z",
        open: false,
      }),
    ],
  });

  beforeEach(() => {
    current = attendance({
      organizationId: ORG,
      businessDate: "2026-09-27",
      selfService: { enabled: true, days: 7 },
      openSession: running,
      sessions: [running],
    });
    write = async () => reply(200, running);
  });

  it("edits only its start: the end reads Still running and opens the clock", async () => {
    await renderSheet("2026-09-27");

    expect(screen.queryByTestId("correction-end")).toBeNull();
    expect(screen.getByTestId("correction-still-running")).toHaveTextContent("Still running");
    expect(screen.queryByTestId("correction-add-break")).toBeNull();
    expect(screen.queryByTestId("correction-past-day")).toBeNull();

    await fireEvent.press(screen.getByTestId("correction-open-clock"));
    expect(onOpenClock).toHaveBeenCalled();
  });

  it("sends the start alone", async () => {
    await renderSheet("2026-09-27");
    await setTime("correction-start", 7, 30);

    await fireEvent.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const patch = mockFetch.mock.calls.find(([, init]) => init.method === "PATCH");
    expect(JSON.parse(patch?.[1].body)).toEqual({ startedAt: "2026-09-27T05:30:00.000Z" });
  });
});

describe("CorrectionSheet, deleting", () => {
  it("offers Delete for a session the reader entered, confirms, deletes and closes", async () => {
    const alert = jest.spyOn(Alert, "alert");
    daySessions = [session({ ...past, origin: "ENTERED", enteredByUserId: "me" })];
    await renderSheet();

    await fireEvent.press(screen.getByTestId("correction-delete"));

    expect(alert).toHaveBeenCalledWith(
      "Delete this session?",
      "Its history stays, the time stops counting.",
      expect.any(Array)
    );
    const buttons = alert.mock.lastCall?.[2] ?? [];
    const destructive = buttons.find((button) => button.style === "destructive");
    daySessions = [];
    await act(async () => {
      await destructive?.onPress?.();
    });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(writes()).toEqual(["DELETE /api/attendance/sessions/s1"]);
  });

  it("shows the earlier-day hint instead for a session clocked before today", async () => {
    await renderSheet();

    expect(screen.queryByTestId("correction-delete")).toBeNull();
    expect(screen.getByTestId("correction-keep-hint")).toHaveTextContent(
      "Clocked on an earlier day, so it can be corrected but not deleted."
    );
  });

  it("shows the admin hint for a session an admin entered", async () => {
    daySessions = [session({ ...past, origin: "ENTERED", enteredByUserId: "admin" })];
    await renderSheet();

    expect(screen.queryByTestId("correction-delete")).toBeNull();
    expect(screen.getByTestId("correction-keep-hint")).toHaveTextContent(
      "Entered by an admin, so it can be corrected but not deleted."
    );
  });
});

describe("CorrectionSheet, a session that closes while the sheet is open", () => {
  // Running since 08:00 on 27 September, on a break since 12:00.
  const running = session({
    id: "s1",
    businessDate: "2026-09-27",
    startedAt: "2026-09-27T06:00:00.000Z",
    endedAt: null,
    open: true,
    breaks: [
      pause({ id: "now", startedAt: "2026-09-27T10:00:00.000Z", endedAt: null, open: true }),
    ],
  });
  // Clocked out at 16:00, which closed the break at 12:30 in the meantime.
  const clockedOut = session({
    ...running,
    endedAt: "2026-09-27T14:00:00.000Z",
    open: false,
    breaks: [
      pause({
        id: "now",
        startedAt: "2026-09-27T10:00:00.000Z",
        endedAt: "2026-09-27T10:30:00.000Z",
        open: false,
      }),
    ],
  });

  beforeEach(() => {
    current = attendance({
      organizationId: ORG,
      businessDate: "2026-09-27",
      selfService: { enabled: true, days: 7 },
      openSession: running,
      sessions: [running],
    });
    write = async () => reply(200, clockedOut);
  });

  it("takes the new ends into the draft and never sends a reopen", async () => {
    const client = await renderSheet("2026-09-27");
    expect(screen.getByTestId("correction-break-1-running")).toHaveTextContent("Running");
    await setTime("correction-start", 7, 30);
    await setTime("correction-break-1-start", 11, 45);

    current = attendance({
      organizationId: ORG,
      businessDate: "2026-09-27",
      selfService: { enabled: true, days: 7 },
      sessions: [clockedOut],
    });
    await act(async () => {
      await client.invalidateQueries();
    });

    expect(await screen.findByTestId("correction-end")).toHaveAccessibilityValue({
      text: "16:00",
    });
    expect(screen.queryByTestId("correction-still-running")).toBeNull();
    expect(screen.getByTestId("correction-break-1-end")).toHaveAccessibilityValue({
      text: "12:30",
    });
    expect(screen.getByTestId("correction-start")).toHaveAccessibilityValue({ text: "07:30" });

    await fireEvent.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const bodies = mockFetch.mock.calls
      .filter(([, init]) => init.method === "PATCH")
      .map(([url, init]) => [new URL(url).pathname, JSON.parse(init.body)]);
    expect(bodies).toEqual([
      ["/api/attendance/sessions/s1", { startedAt: "2026-09-27T05:30:00.000Z" }],
      ["/api/attendance/breaks/now", { startedAt: "2026-09-27T09:45:00.000Z" }],
    ]);
  });
});

describe("CorrectionSheet, a session still open from an earlier day", () => {
  it("finds it through /current's open session when the link names no day", async () => {
    const overnight = session({
      id: "s1",
      businessDate: "2026-09-26",
      startedAt: "2026-09-26T20:00:00.000Z",
      endedAt: null,
      open: true,
    });
    current = attendance({
      organizationId: ORG,
      businessDate: "2026-09-27",
      selfService: { enabled: true, days: 0 },
      openSession: overnight,
      sessions: [],
    });
    daySessions = [overnight];

    await renderSheet("2026-09-27");

    expect(screen.getByTestId("correction-start")).toHaveAccessibilityValue({ text: "22:00" });
    expect(screen.getByTestId("correction-still-running")).toBeTruthy();
  });
});
