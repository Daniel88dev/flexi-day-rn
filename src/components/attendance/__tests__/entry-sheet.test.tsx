import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import { EntrySheet } from "@/components/attendance/entry-sheet";
import { TranslationProvider } from "@/i18n/use-translation";
import type { AttendanceState } from "@/lib/attendance";
import { attendance, attendanceMonth, session } from "@/test-support/attendance";

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
// The native picker as a plain view whose value change a test fires by hand.
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
const OPENED_ON = "2026-09-24";
const reply = (status: number, body: unknown) => ({ status, json: async () => body });

const morning = session({
  id: "morning",
  businessDate: OPENED_ON,
  startedAt: "2026-09-24T06:00:00.000Z",
  endedAt: "2026-09-24T10:00:00.000Z",
  open: false,
});

let current: AttendanceState;
let write: () => Promise<unknown>;

function serve() {
  mockFetch.mockImplementation(async (url: string, init: { method?: string }) => {
    const path = new URL(url).pathname;
    if (init.method === "POST") return write();
    if (path === "/api/attendance/current") return reply(200, current);
    if (path === "/api/attendance/day")
      return reply(200, { organizationId: ORG, timezone: "Europe/Prague", sessions: [morning] });
    if (path === "/api/attendance/month") return reply(200, attendanceMonth(2026, 9));
    return reply(404, {});
  });
}

const reads = (path: string) =>
  mockFetch.mock.calls.filter(([url]) => new URL(url as string).pathname === path).length;

const posted = () =>
  mockFetch.mock.calls
    .filter(([, init]) => init.method === "POST")
    .map(([url, init]) => ({ path: new URL(url).pathname, body: JSON.parse(init.body) }));

const onSaved = jest.fn();

async function renderSheet() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <TranslationProvider>
      <QueryClientProvider client={client}>
        <EntrySheet openedOn={OPENED_ON} onClose={jest.fn()} onSaved={onSaved} />
      </QueryClientProvider>
    </TranslationProvider>
  );
  await screen.findByText("Today or up to 7 days back");
}

const setTime = (testID: string, hours: number, minutes: number) =>
  fireEvent(
    screen.getByTestId(testID),
    "valueChange",
    { type: "set" },
    new Date(2026, 8, 24, hours, minutes)
  );

async function fillSession(start: [number, number], end: [number, number]) {
  await fireEvent.press(screen.getByTestId("entry-start-set"));
  await setTime("entry-start", ...start);
  await fireEvent.press(screen.getByTestId("entry-end-set"));
  await setTime("entry-end", ...end);
}

const saveButton = () => screen.getByTestId("entry-save");

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
  write = async () => reply(201, session({ id: "entered", businessDate: OPENED_ON }));
  serve();
});

afterEach(() => jest.useRealTimers());

describe("EntrySheet", () => {
  it("keeps Save disabled until both times are set, without an error for the empty ones", async () => {
    await renderSheet();

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Set start")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("entry-start-set"));
    expect(screen.getByTestId("entry-start")).toHaveAccessibilityValue({ text: "18:15" });
    expect(saveButton()).toBeDisabled();

    await fireEvent.press(screen.getByTestId("entry-end-set"));
    // An hour after the start, so the two never open on the same minute.
    expect(screen.getByTestId("entry-end")).toHaveAccessibilityValue({ text: "19:15" });
    await setTime("entry-start", 13, 0);

    expect(saveButton()).toBeEnabled();
    expect(screen.queryByTestId("entry-error")).toBeNull();
  });

  it("keeps Save disabled and says why when the entry runs over the day's session", async () => {
    await renderSheet();

    await fillSession([9, 0], [11, 0]);

    expect(
      await screen.findByText("Overlaps your session from 08:00 to 12:00 on this day.")
    ).toBeOnTheScreen();
    expect(saveButton()).toBeDisabled();
  });

  it("hands every change to the discard guard", async () => {
    await renderSheet();
    expect(mockGuard).toHaveBeenLastCalledWith(false);

    await fireEvent.press(screen.getByTestId("entry-start-set"));

    expect(mockGuard).toHaveBeenLastCalledWith(true);
  });

  it("previews the day with the draft from the month's break rules", async () => {
    await renderSheet();

    await fillSession([13, 0], [17, 0]);

    // The morning's four hours count too, so the day passes the threshold.
    expect(screen.getByTestId("entry-preview-presence")).toHaveTextContent("8:00");
    expect(screen.getByTestId("entry-preview-breaks")).toHaveTextContent("0:00");
    expect(screen.getByTestId("entry-preview-worked")).toHaveTextContent("7:30");
  });

  it("enters the session with its break, reads again and hands the saved day on", async () => {
    await renderSheet();
    await fillSession([13, 0], [17, 0]);
    await fireEvent.press(screen.getByTestId("entry-add-break"));
    await fireEvent.press(screen.getByTestId("entry-break-1-start-set"));
    await setTime("entry-break-1-start", 15, 0);
    await fireEvent.press(screen.getByTestId("entry-break-1-end-set"));
    await setTime("entry-break-1-end", 15, 20);
    const monthReads = reads("/api/attendance/month");
    const currentReads = reads("/api/attendance/current");

    await fireEvent.press(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(OPENED_ON));
    expect(posted()).toEqual([
      {
        path: "/api/attendance/sessions",
        body: {
          organizationId: ORG,
          businessDate: OPENED_ON,
          startedAt: "2026-09-24T11:00:00.000Z",
          endedAt: "2026-09-24T15:00:00.000Z",
          breaks: [{ startedAt: "2026-09-24T13:00:00.000Z", endedAt: "2026-09-24T13:20:00.000Z" }],
        },
      },
    ]);
    expect(reads("/api/attendance/current")).toBeGreaterThan(currentReads);
    expect(reads("/api/attendance/month")).toBeGreaterThan(monthReads);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("shows a refusal inline in the web's words, and reads again", async () => {
    write = async () =>
      reply(409, {
        errors: [{ message: "Overlap", context: { reason: "SESSION_OVERLAPS" } }],
      });
    await renderSheet();
    await fillSession([13, 0], [17, 0]);
    const currentReads = reads("/api/attendance/current");

    await fireEvent.press(saveButton());

    expect(await screen.findByText("Another session already covers that time.")).toBeOnTheScreen();
    expect(reads("/api/attendance/current")).toBeGreaterThan(currentReads);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");
    expect(onSaved).not.toHaveBeenCalled();
    expect(saveButton()).toHaveTextContent("Save");
  });

  it("disables Save once a 403 and the read after it close the day", async () => {
    write = async () => {
      current = { ...current, selfService: { enabled: false, days: 7 } };
      return reply(403, { errors: [{ message: "Off", context: { reason: "SELF_SERVICE_OFF" } }] });
    };
    await renderSheet();
    await fillSession([13, 0], [17, 0]);

    await fireEvent.press(saveButton());

    expect(await screen.findByTestId("entry-refused")).toHaveTextContent(
      "Your organization manages attendance corrections through an admin. Ask a group admin, or an organization admin."
    );
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it("turns Save into Retry when the server can't be reached, and retries", async () => {
    write = async () => {
      throw new TypeError("Network request failed");
    };
    await renderSheet();
    await fillSession([13, 0], [17, 0]);

    await fireEvent.press(saveButton());

    expect(await screen.findByText("Can't reach the server")).toBeOnTheScreen();
    expect(saveButton()).toHaveTextContent("Retry");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");

    write = async () => reply(201, session({ id: "entered", businessDate: OPENED_ON }));
    await fireEvent.press(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(OPENED_ON));
    expect(posted()).toHaveLength(2);
  });

  it("offers the next-day switch with the web's hint", async () => {
    await renderSheet();

    await fireEvent(screen.getByTestId("entry-next-day"), "valueChange", true);

    expect(screen.getByTestId("entry-next-day-hint")).toHaveTextContent(
      "Ends Friday, September 25. It stays on Thursday, the day it started."
    );
  });
});
