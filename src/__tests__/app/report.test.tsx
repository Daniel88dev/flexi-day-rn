import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import ReportRoute from "@/app/report";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { ReportScope } from "@/lib/report";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import {
  CROSS_YEAR_TODAY,
  crossOverview,
  crossScope,
  ownerOverview,
  ownerScope,
  reportOverview,
  reportScope,
} from "@/test-support/report";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockFocus: () => void = () => undefined;

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

type Reply = { status: number; body?: unknown } | "offline" | "hold";

const reply = (status: number, body: unknown) => ({ status, json: async () => body });
const held: (() => void)[] = [];

function answer({
  scope = { status: 200, body: ownerScope },
  overview = { status: 200, body: ownerOverview },
  years = {},
}: { scope?: Reply; overview?: Reply; years?: Record<number, Reply> } = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    const year = Number(new URL(url).searchParams.get("year"));
    const pick = url.includes("/api/reports/scope")
      ? scope
      : url.includes("/api/reports/overview")
        ? (years[year] ?? overview)
        : { status: 404, body: {} };
    if (pick === "offline") throw new TypeError("Network request failed");
    if (pick === "hold") {
      return new Promise((resolve) => held.push(() => resolve(reply(200, crossOverview(year)))));
    }
    return reply(pick.status, pick.body);
  });
}

/** The cross-year fixtures: each overview read answers for the year it asked for. */
function answerCrossYear(years: Record<number, Reply> = {}) {
  answer({
    scope: { status: 200, body: crossScope },
    years: {
      2025: { status: 200, body: crossOverview(2025) },
      2026: { status: 200, body: crossOverview(2026) },
      ...years,
    },
  });
}

function dotColor(testID: string): unknown {
  const [dot] = screen.getByTestId(testID).children;
  return typeof dot === "string" ? undefined : dot.props.style.backgroundColor;
}

const urlsOf = (path: string) =>
  mockFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(path));

async function renderReport(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <ReportRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  held.length = 0;
  mockCanGoBack.mockReturnValue(true);
  // Only the date is fixed: the query layer's timers stay real.
  jest.useFakeTimers({
    now: new Date(2026, 9, 4, 10),
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
    ],
  });
  answer();
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

describe("Report route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderReport("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("puts the shell underneath a cold deep link and comes back on top", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderReport();

    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith("/report");
    expect(screen.queryByTestId("report")).toBeNull();
  });

  it("shows the skeleton until the first answer, in the Report shell", async () => {
    mockFetch.mockImplementation(() => new Promise(() => undefined));

    await renderReport();

    expect(within(screen.getByTestId("report")).getByText("Report")).toBeOnTheScreen();
    expect(screen.getByTestId("report-loading")).toBeOnTheScreen();
  });

  it("shows one people list per group in scope, the administered group included", async () => {
    await renderReport();

    const support = await screen.findByTestId("people-g-support");
    expect(within(support).getByText("Dev Support")).toBeOnTheScreen();
    expect(within(support).getByText("2 people, 2026")).toBeOnTheScreen();
    expect(within(screen.getByTestId("people-g-team")).getByText("Dev Team")).toBeOnTheScreen();

    const frank = screen.getByTestId("member-row-u-frank");
    expect(within(frank).getByText("27.5")).toBeOnTheScreen();
    expect(within(frank).getByText("of 31")).toBeOnTheScreen();
    expect(within(frank).getByText("3.5 used")).toBeOnTheScreen();

    const alice = screen.getByTestId("member-row-u-alice");
    expect(within(alice).getByText("10 used, 3 planned, 2 pending")).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("member-row-u-erin")).getByText("13 used, 3 pending")
    ).toBeOnTheScreen();
  });

  it("labels each row with the name and the days left, and shows an overdraft as negative", async () => {
    await renderReport();

    const bob = await screen.findByTestId("member-row-u-bob");
    expect(within(bob).getByText("-1.5")).toBeOnTheScreen();
    expect(bob).toHaveProp("accessibilityLabel", "Bob Dvorak, -1.5 days left of 22");
    expect(bob).toHaveProp("accessibilityRole", "button");
    expect(screen.getByTestId("member-row-u-frank")).toHaveProp(
      "accessibilityLabel",
      "Frank Benes, 27.5 days left of 31"
    );
  });

  it("lists most days left first within a group", async () => {
    await renderReport();

    const team = await screen.findByTestId("people-g-team");
    const names = within(team)
      .getAllByText(/^(Alice Novak|Bob Dvorak)$/)
      .map((node) => node.props.children);
    expect(names).toEqual(["Alice Novak", "Bob Dvorak"]);
  });

  it("reads the overview for this year without a types filter", async () => {
    await renderReport();
    await screen.findByTestId("report-overview");

    const urls = urlsOf("/api/reports/overview");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/\/api\/reports\/overview\?year=2026$/);
    expect(new URL(urls[0]).searchParams.has("types")).toBe(false);
    expect(screen.getByText("Nov 2025 to Oct 2026")).toBeOnTheScreen();
  });

  it("switches every list to the leave type picked", async () => {
    await renderReport();
    const vacation = await screen.findByTestId("report-type-VACATION");
    expect(vacation).toHaveProp("accessibilityState", { selected: true });

    await fireEvent.press(screen.getByTestId("report-type-HOME_OFFICE"));

    expect(screen.getByTestId("report-type-HOME_OFFICE")).toHaveProp("accessibilityState", {
      selected: true,
    });
    const alice = screen.getByTestId("member-row-u-alice");
    expect(within(alice).getByText("44")).toBeOnTheScreen();
    expect(within(alice).getByText("of 50")).toBeOnTheScreen();
    expect(within(alice).getByText("6 used")).toBeOnTheScreen();
  });

  it("hides the leave-type control when the answer has one allowance type", async () => {
    answer({
      scope: { status: 200, body: reportScope() },
      overview: { status: 200, body: reportOverview() },
    });

    await renderReport();

    await screen.findByTestId("member-row-u-alice");
    expect(screen.queryByTestId("report-type-VACATION")).toBeNull();
  });

  it("pushes the member route with the user id and the period when a row is tapped", async () => {
    await renderReport();

    await fireEvent.press(await screen.findByTestId("member-row-u-erin"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/report/[userId]",
      params: { userId: "u-erin", period: "rolling" },
    });
  });

  it("says there is nothing to report for a scope with no groups, and reads no overview", async () => {
    const empty: ReportScope = { groups: [], members: [], years: [] };
    answer({ scope: { status: 200, body: empty } });

    await renderReport();

    expect(await screen.findByTestId("report-empty")).toBeOnTheScreen();
    expect(screen.getByText("Nothing to report yet")).toBeOnTheScreen();
    expect(urlsOf("/api/reports/overview")).toEqual([]);
  });

  it("offers Retry, not a spinner, when the first scope read fails, and loads on Retry", async () => {
    answer({ scope: "offline" });

    await renderReport();

    expect(await screen.findByTestId("report-offline", {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.getByText("Can't reach the server")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-loading")).toBeNull();

    answer();
    await fireEvent.press(screen.getByTestId("report-retry"));

    expect(await screen.findByTestId("people-g-support")).toBeOnTheScreen();
  });

  it("offers Retry when the scope answers but the first overview read fails", async () => {
    answer({ overview: "offline" });

    await renderReport();

    expect(await screen.findByTestId("report-offline", {}, { timeout: 5000 })).toBeOnTheScreen();

    answer();
    await fireEvent.press(screen.getByTestId("report-retry"));

    expect(await screen.findByTestId("people-g-team")).toBeOnTheScreen();
  });

  it("keeps the overview on screen when a reread fails", async () => {
    await renderReport();
    await screen.findByTestId("people-g-team");

    answer({ scope: "offline", overview: "offline" });
    await act(async () => mockFocus());
    await act(async () => mockFocus());

    // The failed reread and its one retry.
    await waitFor(() => expect(urlsOf("/api/reports/scope")).toHaveLength(3), { timeout: 5000 });
    expect(screen.getByTestId("people-g-team")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-offline")).toBeNull();
  });

  it("reads the scope and the overview again when the screen comes back into focus", async () => {
    await renderReport();
    await screen.findByTestId("report-overview");
    await act(async () => mockFocus());

    await act(async () => mockFocus());

    await waitFor(() => expect(urlsOf("/api/reports/overview")).toHaveLength(2));
    expect(urlsOf("/api/reports/scope")).toHaveLength(2);
  });
});

describe("Report usage card across two years", () => {
  const HIDDEN = { includeHiddenElements: true };

  beforeEach(() => {
    jest.setSystemTime(CROSS_YEAR_TODAY);
    answerCrossYear();
  });

  it("shows the window, the total and a column per month above the people lists", async () => {
    await renderReport();

    const card = await screen.findByTestId("usage-card");
    await waitFor(() => expect(within(card).getByText("26.5")).toBeOnTheScreen());
    expect(within(card).getByText("Vacation taken")).toBeOnTheScreen();
    expect(within(card).getByText("Mar 2025 to Feb 2026")).toBeOnTheScreen();
    expect(within(card).getAllByTestId(/^usage-chart-col-\d+$/)).toHaveLength(12);
    expect(screen.getByTestId("usage-chart-col-3")).toHaveProp(
      "accessibilityLabel",
      "June 2025, 8 days: Erin Kral 3, Bob Dvorak 5"
    );
    expect(urlsOf("year=2025")).toHaveLength(1);
    expect(urlsOf("year=2026")).toHaveLength(1);

    const order = screen
      .getAllByTestId(/^(usage-card|people-g-[a-z]+)$/)
      .map((node) => node.props.testID);
    expect(order).toEqual(["usage-card", "people-g-support", "people-g-team", "people-g-design"]);
  });

  it("opens the callout beside a tapped column and closes it on a second tap", async () => {
    await renderReport();
    await waitFor(() => expect(screen.getByText("26.5")).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId("usage-chart-col-4"));

    const callout = within(screen.getByTestId("usage-chart-tip", HIDDEN));
    expect(callout.getByText("July 2025", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("6 d", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Olivia Owner", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Alice Novak", HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId("usage-chart-col-4")).toHaveProp("accessibilityState", {
      selected: true,
    });

    await fireEvent.press(screen.getByTestId("usage-chart-col-4"));

    expect(screen.queryByTestId("usage-chart-tip", HIDDEN)).toBeNull();
  });

  it("toggles a person off in the legend and resets the legend when the leave type changes", async () => {
    await renderReport();
    await waitFor(() => expect(screen.getByText("26.5")).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId("usage-legend-u-bob"));

    expect(screen.getByTestId("usage-legend-u-bob")).toHaveProp("accessibilityState", {
      checked: false,
    });
    expect(screen.getByTestId("usage-chart-col-3")).toHaveProp(
      "accessibilityLabel",
      "June 2025, 3 days: Erin Kral 3"
    );

    await fireEvent.press(screen.getByTestId("report-type-SICK_DAY"));
    await fireEvent.press(screen.getByTestId("report-type-VACATION"));

    expect(screen.getByTestId("usage-legend-u-bob")).toHaveProp("accessibilityState", {
      checked: true,
    });
  });

  it("keeps each person's colour through a leave-type switch and a narrower answer", async () => {
    await renderReport();
    await waitFor(() => expect(screen.getByText("26.5")).toBeOnTheScreen());
    // Frank's avatar hue is too close to Erin's, so the whole scope moves him to the palette.
    const frank = dotColor("usage-legend-u-frank");
    const bob = dotColor("usage-legend-u-bob");
    expect(frank).not.toEqual(crossScope.members.find((m) => m.id === "u-frank")?.avatarColor);

    await fireEvent.press(screen.getByTestId("report-type-SICK_DAY"));
    expect(dotColor("usage-legend-u-bob")).toEqual(bob);
    await fireEvent.press(screen.getByTestId("report-type-VACATION"));

    const picked = (id: string) => id === "u-frank" || id === "u-bob";
    const narrower = (year: number) => {
      const overview = crossOverview(year);
      return {
        ...overview,
        members: overview.members.filter((member) => picked(member.id)),
        monthly: overview.monthly.filter((row) => picked(row.userId)),
        summary: overview.summary.filter((row) => picked(row.userId)),
      };
    };
    answerCrossYear({
      2025: { status: 200, body: narrower(2025) },
      2026: { status: 200, body: narrower(2026) },
    });
    await act(async () => mockFocus());
    await act(async () => mockFocus());

    await waitFor(() => expect(screen.queryByTestId("usage-legend-u-erin")).toBeNull());
    expect(dotColor("usage-legend-u-frank")).toEqual(frank);
    expect(dotColor("usage-legend-u-bob")).toEqual(bob);
  });

  it("says Loading the months while the prior year is outstanding, with the lists already shown", async () => {
    answerCrossYear({ 2025: "hold" });

    await renderReport();

    expect(await screen.findByText("Loading the months")).toBeOnTheScreen();
    expect(screen.getByTestId("people-g-team")).toBeOnTheScreen();
    expect(screen.queryByTestId("usage-chart")).toBeNull();

    await waitFor(() => expect(held).toHaveLength(1));
    await act(async () => held.shift()?.());

    await waitFor(() => expect(screen.getByText("26.5")).toBeOnTheScreen());
    expect(screen.queryByText("Loading the months")).toBeNull();
  });

  it("shows the incomplete note with Retry when the prior year fails, and the whole window after Retry", async () => {
    answerCrossYear({ 2025: "offline" });

    await renderReport();

    const note = await screen.findByTestId("report-incomplete", {}, { timeout: 5000 });
    expect(
      within(note).getByText("2025 didn't load, so its months show no leave yet.")
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId("usage-card")).getByText("6")).toBeOnTheScreen();
    expect(screen.getByTestId("usage-chart")).toBeOnTheScreen();

    answerCrossYear();
    await fireEvent.press(screen.getByTestId("report-incomplete-retry"));

    await waitFor(() => expect(screen.queryByTestId("report-incomplete")).toBeNull());
    expect(within(screen.getByTestId("usage-card")).getByText("26.5")).toBeOnTheScreen();
  });
});
