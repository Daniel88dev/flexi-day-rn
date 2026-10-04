import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import ReportRoute from "@/app/report";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { ReportOverview, ReportScope } from "@/lib/report";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import {
  CROSS_YEAR_TODAY,
  crossOverview,
  crossScope,
  narrowOverview,
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
/** Set to hold every overview answer, as a slow connection would, until a test releases it. */
let holdOverviews = false;

const listParam = (url: URL, name: string) => url.searchParams.get(name)?.split(",");

/** An overview answer narrowed the way the backend narrows it by the request's filters. */
function narrowed(url: string, body: unknown): unknown {
  const params = new URL(url);
  return narrowOverview(body as ReportOverview, {
    groupIds: listParam(params, "groupIds"),
    userIds: listParam(params, "userIds"),
  });
}

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
    const overviewRead = url.includes("/api/reports/overview");
    if (pick === "hold") {
      return new Promise((resolve) =>
        held.push(() => resolve(reply(200, narrowed(url, crossOverview(year)))))
      );
    }
    const body = overviewRead && pick.status === 200 ? narrowed(url, pick.body) : pick.body;
    if (overviewRead && holdOverviews) {
      return new Promise((resolve) => held.push(() => resolve(reply(pick.status, body))));
    }
    return reply(pick.status, body);
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
  holdOverviews = false;
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

describe("Report filters", () => {
  const classesOf = (testID: string) => String(screen.getByTestId(testID).props.className);
  const lastOverviewUrl = () => new URL(urlsOf("/api/reports/overview").at(-1) ?? "");

  async function openSheet(chip: string, sheet: string) {
    await fireEvent.press(await screen.findByTestId(chip));
    return screen.getByTestId(sheet);
  }

  it("renders the Period, Groups and People chips on their defaults, labelled with their choice", async () => {
    await renderReport();

    const period = await screen.findByTestId("report-period");
    expect(within(period).getByText("Last 12 months")).toBeOnTheScreen();
    expect(period).toHaveProp("accessibilityLabel", "Period, Last 12 months");
    expect(screen.getByTestId("report-groups")).toHaveProp(
      "accessibilityLabel",
      "Groups, All groups"
    );
    expect(screen.getByTestId("report-members")).toHaveProp(
      "accessibilityLabel",
      "People, Everyone"
    );
    for (const chip of ["report-period", "report-groups", "report-members"]) {
      expect(classesOf(chip)).not.toContain("bg-accent");
    }
  });

  it("hides the Groups chip when the scope has one group", async () => {
    answer({
      scope: { status: 200, body: reportScope() },
      overview: { status: 200, body: reportOverview() },
    });

    await renderReport();

    expect(await screen.findByTestId("report-members")).toBeOnTheScreen();
    expect(screen.getByTestId("report-period")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-groups")).toBeNull();
  });

  it("offers the last 12 months and each year in scope newest first, and reads the year picked", async () => {
    answer({
      scope: { status: 200, body: { ...ownerScope, years: [2024, 2026] } },
      years: { 2024: { status: 200, body: { ...ownerOverview, year: 2024 } } },
    });
    await renderReport();

    const sheet = await openSheet("report-period", "period-sheet");
    const rows = within(sheet)
      .getAllByTestId(/^period-sheet-(rolling|\d{4})$/)
      .map((row) => row.props.testID);
    expect(rows).toEqual(["period-sheet-rolling", "period-sheet-2026", "period-sheet-2024"]);
    expect(screen.getByTestId("period-sheet-rolling")).toHaveProp("accessibilityState", {
      checked: true,
    });
    expect(within(sheet).getByText("Nov 2025 to Oct 2026")).toBeOnTheScreen();
    expect(within(sheet).getByText("January to December, this year")).toBeOnTheScreen();
    expect(within(sheet).getByText("January to December")).toBeOnTheScreen();
    expect(urlsOf("year=2024")).toEqual([]);

    await fireEvent.press(screen.getByTestId("period-sheet-2024"));

    await waitFor(() => expect(lastOverviewUrl().searchParams.get("year")).toBe("2024"));
    expect(screen.queryByTestId("period-sheet")).toBeNull();
    const period = screen.getByTestId("report-period");
    expect(period).toHaveProp("accessibilityLabel", "Period, 2024");
    expect(classesOf("report-period")).toContain("bg-accent");
    await waitFor(() =>
      expect(within(screen.getByTestId("usage-card")).getByText("2024")).toBeOnTheScreen()
    );
    expect(
      within(screen.getByTestId("people-g-team")).getByText("2 people, 2024")
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("member-row-u-erin"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/report/[userId]",
      params: { userId: "u-erin", period: "2024" },
    });
  });

  it("switches the window and the people lists to January to December of the year picked", async () => {
    jest.setSystemTime(CROSS_YEAR_TODAY);
    answerCrossYear();
    await renderReport();
    await waitFor(() => expect(screen.getByText("26.5")).toBeOnTheScreen());

    await openSheet("report-period", "period-sheet");
    await fireEvent.press(screen.getByTestId("period-sheet-2025"));

    const card = screen.getByTestId("usage-card");
    await waitFor(() => expect(within(card).getByText("22.5")).toBeOnTheScreen());
    expect(within(card).getByText("2025")).toBeOnTheScreen();
    expect(screen.getByTestId("usage-chart-col-0").props.accessibilityLabel).toMatch(
      /^January 2025, 2 days/
    );
    expect(screen.getByTestId("usage-chart-col-11").props.accessibilityLabel).toMatch(
      /^December 2025/
    );
    const frank = screen.getByTestId("member-row-u-frank");
    expect(within(frank).getByText("3")).toBeOnTheScreen();
    expect(within(frank).getByText("of 28")).toBeOnTheScreen();
    expect(urlsOf("year=2024")).toEqual([]);
  });

  it("narrows the sections to the groups picked and labels the chip by name, then by count", async () => {
    jest.setSystemTime(CROSS_YEAR_TODAY);
    answerCrossYear();
    await renderReport();

    const sheet = await openSheet("report-groups", "groups-sheet");
    expect(screen.getByTestId("groups-sheet-all")).toHaveProp("accessibilityState", {
      checked: true,
    });
    expect(within(screen.getByTestId("groups-sheet-g-support")).getByText("2 people")).toBeTruthy();
    expect(within(sheet).getByText("Design Guild")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("groups-sheet-g-team"));

    await waitFor(() => expect(screen.queryByTestId("people-g-support")).toBeNull());
    expect(screen.getByTestId("people-g-team")).toBeOnTheScreen();
    expect(screen.queryByTestId("people-g-design")).toBeNull();
    expect(lastOverviewUrl().searchParams.get("groupIds")).toBe("g-team");
    expect(screen.getByTestId("report-groups")).toHaveProp(
      "accessibilityLabel",
      "Groups, Dev Team"
    );
    expect(classesOf("report-groups")).toContain("bg-accent");
    expect(screen.getByTestId("groups-sheet-all")).toHaveProp("accessibilityState", {
      checked: false,
    });

    await fireEvent.press(screen.getByTestId("groups-sheet-g-design"));

    await waitFor(() => expect(screen.getByTestId("people-g-design")).toBeOnTheScreen());
    expect(within(screen.getByTestId("report-groups")).getByText("2 groups")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("groups-sheet-all"));

    await waitFor(() => expect(screen.getByTestId("people-g-support")).toBeOnTheScreen());
    expect(within(screen.getByTestId("report-groups")).getByText("All groups")).toBeOnTheScreen();
    expect(classesOf("report-groups")).not.toContain("bg-accent");

    await fireEvent.press(screen.getByTestId("groups-sheet-done"));
    expect(screen.queryByTestId("groups-sheet")).toBeNull();
  });

  it("offers the people of the picked groups and narrows the rows to the people picked", async () => {
    await renderReport();

    const sheet = await openSheet("report-members", "members-sheet");
    const offered = within(sheet)
      .getAllByTestId(/^members-sheet-u-/)
      .map((row) => row.props.testID);
    expect(offered).toEqual([
      "members-sheet-u-alice",
      "members-sheet-u-bob",
      "members-sheet-u-erin",
      "members-sheet-u-frank",
    ]);
    expect(within(screen.getByTestId("members-sheet-u-erin")).getByText("EK")).toBeTruthy();
    expect(
      within(screen.getByTestId("members-sheet-u-erin")).getByText("Dev Support")
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId("members-sheet-u-erin"));

    await waitFor(() => expect(screen.queryByTestId("member-row-u-frank")).toBeNull());
    expect(screen.getByTestId("member-row-u-erin")).toBeOnTheScreen();
    expect(screen.queryByTestId("people-g-team")).toBeNull();
    expect(lastOverviewUrl().searchParams.get("userIds")).toBe("u-erin");
    expect(screen.getByTestId("report-members")).toHaveProp(
      "accessibilityLabel",
      "People, Erin Kral"
    );
    expect(classesOf("report-members")).toContain("bg-accent");

    await fireEvent.press(screen.getByTestId("members-sheet-u-alice"));

    await waitFor(() => expect(screen.getByTestId("member-row-u-alice")).toBeOnTheScreen());
    expect(within(screen.getByTestId("report-members")).getByText("2 people")).toBeOnTheScreen();
  });

  it("drops picked people outside the groups picked, so People never hides everyone", async () => {
    await renderReport();

    await openSheet("report-members", "members-sheet");
    await fireEvent.press(screen.getByTestId("members-sheet-u-frank"));
    await fireEvent.press(screen.getByTestId("members-sheet-u-alice"));
    await fireEvent.press(screen.getByTestId("members-sheet-done"));
    expect(within(screen.getByTestId("report-members")).getByText("2 people")).toBeOnTheScreen();

    await openSheet("report-groups", "groups-sheet");
    await fireEvent.press(screen.getByTestId("groups-sheet-g-team"));

    expect(within(screen.getByTestId("report-members")).getByText("Alice Novak")).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId("people-g-support")).toBeNull());
    expect(lastOverviewUrl().searchParams.get("userIds")).toBe("u-alice");
    expect(lastOverviewUrl().searchParams.get("groupIds")).toBe("g-team");

    await fireEvent.press(screen.getByTestId("groups-sheet-done"));
    const sheet = await openSheet("report-members", "members-sheet");
    expect(
      within(sheet)
        .getAllByTestId(/^members-sheet-u-/)
        .map((row) => row.props.testID)
    ).toEqual(["members-sheet-u-alice", "members-sheet-u-bob"]);
  });

  it("keeps the screen and the open sheet while a filter change reads again, saying Loading the months", async () => {
    await renderReport();
    await openSheet("report-groups", "groups-sheet");

    holdOverviews = true;
    await fireEvent.press(screen.getByTestId("groups-sheet-g-team"));
    await waitFor(() => expect(held).toHaveLength(1));

    expect(screen.getByTestId("groups-sheet")).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("usage-card")).getByText("Loading the months")
    ).toBeOnTheScreen();
    expect(screen.getByTestId("people-g-support")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-loading")).toBeNull();

    holdOverviews = false;
    await act(async () => held.shift()?.());

    await waitFor(() => expect(screen.queryByTestId("people-g-support")).toBeNull());
    expect(screen.queryByText("Loading the months")).toBeNull();
    expect(screen.getByTestId("groups-sheet")).toBeOnTheScreen();
  });

  it("falls back to the first leave type when the picked one leaves the answer, and stays there", async () => {
    await renderReport();
    await fireEvent.press(await screen.findByTestId("report-type-HOME_OFFICE"));

    await openSheet("report-groups", "groups-sheet");
    await fireEvent.press(screen.getByTestId("groups-sheet-g-support"));

    await waitFor(() => expect(screen.queryByTestId("report-type-HOME_OFFICE")).toBeNull());
    expect(within(screen.getByTestId("member-row-u-frank")).getByText("27.5")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("groups-sheet-all"));

    await waitFor(() => expect(screen.getByTestId("people-g-team")).toBeOnTheScreen());
    expect(screen.getByTestId("report-type-VACATION")).toHaveProp("accessibilityState", {
      selected: true,
    });
  });

  it("starts from the defaults on the next visit", async () => {
    await renderReport();
    await openSheet("report-groups", "groups-sheet");
    await fireEvent.press(screen.getByTestId("groups-sheet-g-team"));
    await waitFor(() => expect(screen.queryByTestId("people-g-support")).toBeNull());

    await act(async () => screen.unmount());
    await renderReport();

    expect(await screen.findByTestId("people-g-support")).toBeOnTheScreen();
    expect(within(screen.getByTestId("report-groups")).getByText("All groups")).toBeOnTheScreen();
  });
});
