import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";

import Screen from "@/app/(app)/my-attendance";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import { attendance, attendanceMonth, pause, session } from "@/test-support/attendance";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockParams: { date?: string } = {};

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    router: { setParams: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
});

jest.mock("@/components/notifications/notification-bell", () => {
  const { View } = jest.requireActual("react-native");
  return { NotificationBell: () => <View testID="notification-bell" /> };
});

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

const ORG = "org-1";
const pastSession = session({
  id: "past",
  businessDate: "2026-09-24",
  startedAt: "2026-09-24T06:00:00.000Z",
  endedAt: "2026-09-24T10:00:00.000Z",
  closedBy: "SWEEP",
  open: false,
  breaks: [
    pause({
      startedAt: "2026-09-24T08:00:00.000Z",
      endedAt: "2026-09-24T08:20:00.000Z",
      open: false,
    }),
  ],
});

const MONTH = {
  organizationId: ORG,
  balanceMode: "DAILY",
  days: [
    {
      businessDate: "2026-09-24",
      presenceMinutes: 240,
      workedMinutes: 220,
      requiredMinutes: 480,
      balanceMinutes: -260,
      exclusion: null,
    },
    {
      businessDate: "2026-09-27",
      presenceMinutes: 0,
      workedMinutes: 0,
      requiredMinutes: 480,
      balanceMinutes: -480,
      exclusion: null,
    },
  ],
};

type Answer = { status: number; body: unknown };

function answer(current: Answer) {
  mockFetch.mockImplementation(async (url: string) => {
    const reply = (status: number, body: unknown) => ({ status, json: async () => body });
    if (url.includes("/api/attendance/current")) return reply(current.status, current.body);
    if (url.includes("/api/attendance/day"))
      return reply(200, {
        organizationId: ORG,
        timezone: "Europe/Prague",
        sessions: [pastSession],
      });
    if (url.includes("/api/attendance/month")) return reply(200, MONTH);
    return reply(404, {});
  });
}

const readsOf = (path: string) =>
  mockFetch.mock.calls.filter(([url]) => (url as string).includes(path)).map(([url]) => url);

async function renderScreen() {
  await render(
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <Screen />
      </TranslationProvider>
    </QueryClientProvider>
  );
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.date;
  answer({ status: 200, body: attendance({ organizationId: ORG, businessDate: "2026-09-27" }) });
});

afterEach(() => queryClient.clear());

describe("My attendance", () => {
  it("renders the notification bell in the header", async () => {
    await renderScreen();

    expect(await screen.findByTestId("notification-bell")).toBeOnTheScreen();
  });

  it("opens on today with the clock card over the day", async () => {
    await renderScreen();

    expect(await screen.findByTestId("attendance-clock-card")).toBeTruthy();
    expect(screen.getByText("Sunday, September 27")).toBeTruthy();
    expect(await screen.findByText("Worked 0:00 of 8:00")).toBeTruthy();
    expect(readsOf("/api/attendance/day")).toEqual([]);
  });

  it("opens a ?date= link on that day, from /day, without the clock card", async () => {
    mockParams.date = "2026-09-24";
    await renderScreen();

    expect(await screen.findByText("Thursday, September 24")).toBeTruthy();
    expect(await screen.findByTestId("mark-auto-closed")).toBeTruthy();
    expect(screen.queryByTestId("attendance-clock-card")).toBeNull();
    expect(screen.getByText("Worked 3:40 of 8:00")).toBeTruthy();
    expect(readsOf("/api/attendance/day")[0]).toContain("businessDate=2026-09-24");
    expect(router.setParams).toHaveBeenCalledWith({ date: undefined });
  });

  it.each([["2026-10-30"], ["yesterday"]])("opens today for the link %s", async (date) => {
    mockParams.date = date;
    await renderScreen();

    expect(await screen.findByTestId("attendance-clock-card")).toBeTruthy();
    expect(screen.getByText("Sunday, September 27")).toBeTruthy();
  });

  it("says attendance is not set up when /current answers 404, with no views", async () => {
    answer({ status: 404, body: {} });
    await renderScreen();

    expect(await screen.findByText("Attendance isn't set up for you")).toBeTruthy();
    expect(screen.queryByTestId("attendance-day")).toBeNull();
    expect(screen.queryByTestId("attendance-view-day")).toBeNull();
  });

  it("keeps history readable for a lapsed organization, the clock card showing its lock", async () => {
    answer({
      status: 200,
      body: attendance({ organizationId: ORG, active: false, sessions: [] }),
    });
    await renderScreen();

    const card = await screen.findByTestId("attendance-clock-card");
    expect(await within(card).findByText("Clocking in is off")).toBeTruthy();
    expect(within(card).queryByTestId("clock-in")).toBeNull();
    expect(screen.getByTestId("attendance-day-previous")).toBeTruthy();
  });

  it("is read-only once the Employment has ended", async () => {
    answer({
      status: 200,
      body: attendance({ organizationId: ORG, employmentEnded: true }),
    });
    await renderScreen();

    const card = await screen.findByTestId("attendance-clock-card");
    expect(await within(card).findByText("Your employment here has ended")).toBeTruthy();
    expect(within(card).queryByTestId("clock-in")).toBeNull();
  });

  it("reads /current, the visible /day and the visible month again on pull-to-refresh", async () => {
    mockParams.date = "2026-09-24";
    await renderScreen();
    await screen.findByTestId("mark-auto-closed");
    mockFetch.mockClear();

    const scroll = screen.getByTestId("my-attendance");
    await act(async () => scroll.props.refreshControl.props.onRefresh());

    expect(readsOf("/api/attendance/current")).toHaveLength(1);
    expect(readsOf("/api/attendance/day")).toHaveLength(1);
    expect(readsOf("/api/attendance/month")).toHaveLength(1);
    expect(readsOf("/api/attendance/month")[0]).toContain("month=9");
  });
});

describe("My attendance, self-service", () => {
  const WINDOW = { enabled: true, days: 7 };

  // A day with `pastSession` on the 24th, nothing on the 25th, and the whole month in /month.
  function serve(state: ReturnType<typeof attendance>) {
    mockFetch.mockImplementation(async (url: string) => {
      const reply = (status: number, body: unknown) => ({ status, json: async () => body });
      if (url.includes("/api/attendance/current")) return reply(200, state);
      if (url.includes("/api/attendance/day")) {
        const date = new URLSearchParams(url.split("?")[1]).get("businessDate");
        return reply(200, {
          organizationId: ORG,
          timezone: "Europe/Prague",
          sessions: date === "2026-09-24" ? [pastSession] : [],
        });
      }
      if (url.includes("/api/attendance/month")) return reply(200, attendanceMonth(2026, 9));
      return reply(404, {});
    });
  }

  const own = (overrides: Parameters<typeof attendance>[0] = {}) =>
    attendance({
      organizationId: ORG,
      businessDate: "2026-09-27",
      selfService: WINDOW,
      ...overrides,
    });

  it("offers Add session under a past day's sessions, with the window's hint at the foot", async () => {
    serve(own());
    mockParams.date = "2026-09-24";
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("add-session-row"));

    expect(router.navigate).toHaveBeenCalledWith({
      pathname: "/my-attendance/entry",
      params: { date: "2026-09-24" },
    });
    expect(screen.getByTestId("window-hint")).toHaveTextContent(
      "You can enter and correct your attendance for today and the 7 days before it. Earlier days go through your admin."
    );
  });

  it("asks about a forgotten clock on an empty past day, with a filled Add", async () => {
    serve(own());
    mockParams.date = "2026-09-25";
    await renderScreen();

    expect(
      await screen.findByText("Forgot to clock? Add the session with its start and end.")
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId("empty-day-add"));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: "/my-attendance/entry",
      params: { date: "2026-09-25" },
    });
    expect(screen.queryByTestId("add-session-row")).toBeNull();
  });

  it("offers Add on an empty today without the forgotten-clock prompt", async () => {
    serve(own());
    await renderScreen();

    expect(await screen.findByTestId("empty-day-add")).toBeTruthy();
    expect(screen.getByText("Nothing recorded today yet.")).toBeTruthy();
    expect(
      screen.queryByText("Forgot to clock? Add the session with its start and end.")
    ).toBeNull();
  });

  it("locks a day before the window, with no Add", async () => {
    serve(own({ selfService: { enabled: true, days: 1 } }));
    mockParams.date = "2026-09-24";
    await renderScreen();

    expect(await screen.findByTestId("window-lock")).toHaveTextContent(
      "Only an admin can change a day this old. You can enter and correct today and the 1 day before it. For anything earlier, ask a group admin or an organization admin."
    );
    expect(screen.queryByTestId("add-session-row")).toBeNull();
  });

  it("shows the quiet off notice and no Add while the window is off", async () => {
    serve(own({ selfService: { enabled: false, days: 7 } }));
    await renderScreen();

    expect(await screen.findByTestId("window-off")).toBeTruthy();
    expect(screen.queryByTestId("empty-day-add")).toBeNull();
  });

  it("opens the correction sheet from a session group inside the window", async () => {
    serve(own());
    mockParams.date = "2026-09-24";
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("session-correct"));

    expect(router.navigate).toHaveBeenCalledWith({
      pathname: "/my-attendance/session/[id]",
      params: { id: "past", date: "2026-09-24" },
    });
  });

  it("leaves a session group before the window untappable", async () => {
    serve(own({ selfService: { enabled: true, days: 1 } }));
    mockParams.date = "2026-09-24";
    await renderScreen();

    await screen.findByTestId("window-lock");
    expect(screen.getByTestId("session-group")).toBeTruthy();
    expect(screen.queryByTestId("session-correct")).toBeNull();
  });

  it("leaves every session group untappable while the window is off", async () => {
    serve(own({ selfService: { enabled: false, days: 7 } }));
    mockParams.date = "2026-09-24";
    await renderScreen();

    await screen.findByTestId("session-group");
    expect(screen.queryByTestId("session-correct")).toBeNull();
  });

  it("says nothing about the window while the plan has lapsed", async () => {
    serve(own({ active: false }));
    await renderScreen();

    await screen.findByTestId("attendance-day-card");
    expect(await screen.findByText("Worked 5:14 of 8:00")).toBeTruthy();
    expect(screen.queryByTestId("window-hint")).toBeNull();
    expect(screen.queryByTestId("window-lock")).toBeNull();
    expect(screen.queryByTestId("window-off")).toBeNull();
    expect(screen.queryByTestId("empty-day-add")).toBeNull();
  });
});

describe("My attendance, Week and Month", () => {
  // The backend marks every date after its business date as upcoming.
  function monthUpTo(year: number, month: number, today: string, fails = false) {
    const data = attendanceMonth(year, month, { businessDate: today });
    for (const day of data.days) day.upcoming = day.businessDate > today;
    return { status: fails ? 500 : 200, body: data };
  }

  function answerRange(today: string, failing: number | null = null) {
    mockFetch.mockImplementation(async (url: string) => {
      const reply = (status: number, body: unknown) => ({ status, json: async () => body });
      if (url.includes("/api/attendance/current"))
        return reply(200, attendance({ organizationId: ORG, businessDate: today }));
      if (url.includes("/api/attendance/month")) {
        const params = new URLSearchParams(url.split("?")[1]);
        const month = Number(params.get("month"));
        const answer = monthUpTo(Number(params.get("year")), month, today, month === failing);
        return reply(answer.status, answer.body);
      }
      return reply(200, { organizationId: ORG, timezone: "Europe/Prague", sessions: [] });
    });
  }

  const rowDates = () =>
    screen
      .getAllByTestId(/^day-row-/)
      .map((row) => (row.props.testID as string).replace("day-row-", ""));

  it("shows a straddling week's stat card and seven rows, read from both months", async () => {
    answerRange("2026-10-01");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("attendance-view-week"));

    expect(await screen.findByTestId("attendance-week")).toBeTruthy();
    expect(screen.getByText("Sep 28 - Oct 4")).toBeTruthy();
    expect(within(screen.getByTestId("attendance-stats")).getByText("Flagged")).toBeTruthy();
    expect(rowDates()).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(screen.getAllByText("To come")).toHaveLength(3);
    expect(screen.getByTestId("legend-week")).toBeTruthy();
    const months = readsOf("/api/attendance/month").map((url) =>
      new URLSearchParams((url as string).split("?")[1]).get("month")
    );
    expect(new Set(months)).toEqual(new Set(["9", "10"]));
  });

  it("shows the error rather than half a week when one of its months fails", async () => {
    answerRange("2026-10-01", 10);
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("attendance-view-week"));

    // A 5xx gets one retry a second later before it counts as failed.
    expect(
      await screen.findByTestId("attendance-range-failed", {}, { timeout: 3000 })
    ).toBeTruthy();
    expect(screen.queryAllByTestId(/^day-row-/)).toHaveLength(0);
  });

  it("reads only the failed month again on Retry", async () => {
    answerRange("2026-10-01", 10);
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("attendance-view-week"));
    await screen.findByTestId("attendance-range-failed", {}, { timeout: 3000 });
    answerRange("2026-10-01");
    mockFetch.mockClear();

    await fireEvent.press(screen.getByText("Retry"));

    expect(await screen.findByTestId("attendance-week")).toBeTruthy();
    const months = readsOf("/api/attendance/month").map((url) =>
      new URLSearchParams((url as string).split("?")[1]).get("month")
    );
    expect(months).toEqual(["10"]);
  });

  it("shows the month's past days newest first, with the stat card and the legends", async () => {
    answerRange("2026-09-27");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("attendance-view-month"));

    expect(await screen.findByTestId("attendance-month")).toBeTruthy();
    expect(screen.getByText("September 2026")).toBeTruthy();
    expect(within(screen.getByTestId("attendance-stats")).getByText("Excluded days")).toBeTruthy();
    const dates = rowDates();
    expect(dates).toHaveLength(27);
    expect(dates.slice(0, 2)).toEqual(["2026-09-27", "2026-09-26"]);
    expect(screen.queryByTestId("legend-week")).toBeNull();
    expect(screen.getByTestId("legend-hatched")).toBeTruthy();
    expect(screen.getByTestId("legend-entered")).toBeTruthy();
    expect(screen.getByTestId("legend-changed")).toBeTruthy();
  });

  it("pushes a past day's Day screen from its row", async () => {
    answerRange("2026-09-27");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("attendance-view-month"));

    await fireEvent.press(await screen.findByTestId("day-row-2026-09-24"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/attendance/[date]",
      params: { date: "2026-09-24" },
    });
  });

  it("resets to today when the view switches", async () => {
    answerRange("2026-09-27");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("attendance-view-week"));
    await fireEvent.press(await screen.findByTestId("attendance-range-previous"));
    expect(await screen.findByText("Sep 14 - Sep 20")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("attendance-view-month"));
    expect(await screen.findByText("September 2026")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("attendance-view-week"));
    expect(await screen.findByText("Sep 21 - Sep 27")).toBeTruthy();
  });

  it("reads /current and both months of a straddling week again on pull-to-refresh", async () => {
    answerRange("2026-10-01");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("attendance-view-week"));
    await screen.findByTestId("attendance-week");
    mockFetch.mockClear();

    const scroll = screen.getByTestId("my-attendance");
    await act(async () => scroll.props.refreshControl.props.onRefresh());

    expect(readsOf("/api/attendance/current")).toHaveLength(1);
    expect(readsOf("/api/attendance/month")).toHaveLength(2);
    expect(readsOf("/api/attendance/day")).toHaveLength(0);
  });
});
