import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";

import Screen from "@/app/(app)/my-attendance";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import { attendance, pause, session } from "@/test-support/attendance";

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
    router: { setParams: jest.fn(), navigate: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
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

beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.date;
  answer({ status: 200, body: attendance({ organizationId: ORG, businessDate: "2026-09-27" }) });
});

afterEach(() => queryClient.clear());

describe("My attendance", () => {
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
