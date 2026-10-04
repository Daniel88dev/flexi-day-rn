import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import MemberReportRoute from "@/app/report/[userId]";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { MemberReport, ReportScope } from "@/lib/report";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import {
  CROSS_YEAR_TODAY,
  crossMember2025,
  crossMember2026,
  crossScope,
  erinOnDefaults,
  memberReport,
  ownerScope,
  scopeGroup,
  summaryRow,
} from "@/test-support/report";
import { pressableProblems } from "@/test-support/accessibility";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockParams: { userId: string; period?: string } = { userId: "u-bob" };
const mockCanGoBack = jest.fn(() => true);
let mockFocus: () => void = () => undefined;
let mockLanguage = "en";

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
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: mockLanguage }],
  getCalendars: () => [{ uses24hourClock: true }],
}));
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
const crossMember = (year: number) => (year === 2025 ? crossMember2025 : crossMember2026);

/** Bob's years from the cross-year fixtures, each read answering for the year it asked for. */
function answer({
  scope = crossScope,
  members = {},
  member = crossMember,
}: {
  scope?: ReportScope;
  members?: Record<number, Reply>;
  member?: (year: number) => MemberReport;
} = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/api/reports/scope")) return reply(200, scope);
    if (url.includes("/api/reports/members/")) {
      const year = Number(new URL(url).searchParams.get("year"));
      const pick = members[year] ?? { status: 200 };
      if (pick === "offline") throw new TypeError("Network request failed");
      if (pick === "hold") {
        return new Promise((resolve) => held.push(() => resolve(reply(200, member(year)))));
      }
      return reply(pick.status, pick.body ?? member(year));
    }
    return reply(404, {});
  });
}

const urlsOf = (path: string) =>
  mockFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(path));

const HIDDEN = { includeHiddenElements: true };

async function renderMember(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <MemberReportRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

async function layOut(testID: string) {
  await fireEvent(screen.getByTestId(testID), "layout", {
    nativeEvent: { layout: { width: 320, height: 150, x: 0, y: 0 } },
  });
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  held.length = 0;
  mockLanguage = "en";
  mockCanGoBack.mockReturnValue(true);
  mockParams.userId = "u-bob";
  mockParams.period = "rolling";
  // Only the date is fixed: the query layer's timers stay real.
  jest.useFakeTimers({
    now: CROSS_YEAR_TODAY,
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
  onlineManager.setOnline(true);
  queryClient.clear();
  jest.useRealTimers();
});

describe("Member report route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderMember("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("puts the shell underneath a cold deep link and comes back on top with the same period", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderMember();

    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/report/[userId]",
      params: { userId: "u-bob", period: "rolling" },
    });
    expect(screen.queryByTestId("report-member")).toBeNull();
  });

  it("shows a back button labelled Report and no title", async () => {
    await renderMember();
    await screen.findByTestId("member-report");

    const back = screen.getByTestId("stack-back");
    expect(back).toHaveProp("accessibilityLabel", "Report");
    expect(within(back).getByText("Report")).toBeOnTheScreen();
    expect(screen.getAllByText("Report")).toHaveLength(1);

    await fireEvent.press(back);
    expect(router.back).toHaveBeenCalled();
  });

  it("shows the skeleton until the person's report answers", async () => {
    mockFetch.mockImplementation(() => new Promise(() => undefined));

    await renderMember();

    expect(screen.getByTestId("report-member")).toBeOnTheScreen();
    expect(screen.getByTestId("report-loading")).toBeOnTheScreen();
  });

  it("shows the avatar, the name and the groups you share as plain text", async () => {
    answer({
      member: (year) => ({
        ...crossMember(year),
        groups: [scopeGroup({ groupId: "g-support", groupName: "Dev Support" }), scopeGroup()],
      }),
    });

    await renderMember();

    const member = await screen.findByTestId("member-report");
    expect(within(member).getByText("BD")).toBeOnTheScreen();
    expect(within(member).getByText("Bob Dvorak")).toBeOnTheScreen();
    expect(within(member).getByText("Dev Support, Dev Team")).toBeOnTheScreen();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("reads the person's year and the year before for the period the row was showing", async () => {
    await renderMember();
    await screen.findByTestId("member-report");

    expect(screen.getByTestId("member-period")).toHaveProp(
      "accessibilityLabel",
      "Period, Last 12 months"
    );
    await waitFor(() =>
      expect(urlsOf("/api/reports/members/")).toEqual([
        expect.stringMatching(/\/api\/reports\/members\/u-bob\?year=2026$/),
        expect.stringMatching(/\/api\/reports\/members\/u-bob\?year=2025$/),
      ])
    );
    expect(
      within(screen.getByTestId("allowance-VACATION")).getByText("Mar 2025 to Feb 2026")
    ).toBeOnTheScreen();
  });

  it("opens on the calendar year the row was showing", async () => {
    mockParams.period = "2025";

    await renderMember();
    await screen.findByTestId("member-report");

    expect(screen.getByTestId("member-period")).toHaveProp("accessibilityLabel", "Period, 2025");
    expect(urlsOf("/api/reports/members/")).toEqual([
      expect.stringMatching(/\/api\/reports\/members\/u-bob\?year=2025$/),
    ]);
    const vacation = screen.getByTestId("allowance-VACATION");
    expect(within(vacation).getAllByText("2025")).toHaveLength(2);
  });

  it("switches the person's window from the period chip, on this screen only", async () => {
    await renderMember();
    await screen.findByTestId("member-report");

    await fireEvent.press(screen.getByTestId("member-period"));
    expect(screen.getByTestId("member-period-sheet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("member-period-sheet-2025"));

    await waitFor(() =>
      expect(screen.getByTestId("member-period")).toHaveProp("accessibilityLabel", "Period, 2025")
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId("allowance-VACATION")).getByLabelText("Used, 8")
      ).toBeOnTheScreen()
    );
    expect(urlsOf("year=2025").length).toBeGreaterThan(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows one card per allowance in order, the days left and what makes them up", async () => {
    await renderMember();
    await screen.findByTestId("member-report");

    const order = screen
      .getAllByTestId(/^allowance-[A-Z_]+$/)
      .map((node) => node.props.testID as string);
    expect(order).toEqual(["allowance-VACATION", "allowance-SICK_DAY"]);

    const sick = within(screen.getByTestId("allowance-SICK_DAY"));
    expect(sick.getByText("Sick day")).toBeOnTheScreen();
    expect(sick.getByLabelText("5 days left of 5")).toBeOnTheScreen();
    expect(sick.getByLabelText("Used, 0")).toBeOnTheScreen();
    const left = within(screen.getByTestId("allowance-SICK_DAY-left")).getByText("5");
    expect(left.props.className).not.toContain("text-danger");
  });

  it("shows an overdrawn allowance in red as days over", async () => {
    await renderMember();
    await screen.findByTestId("member-report");

    const vacation = within(screen.getByTestId("allowance-VACATION"));
    expect(vacation.getByLabelText("1.5 days over of 22")).toBeOnTheScreen();
    expect(vacation.getByText("days over of 22")).toBeOnTheScreen();
    const left = within(screen.getByTestId("allowance-VACATION-left")).getByText("1.5");
    expect(left.props.className).toContain("text-danger");
    expect(vacation.getByLabelText("Used, 1.5")).toBeOnTheScreen();
    expect(vacation.getByLabelText("Planned, 22")).toBeOnTheScreen();
    expect(vacation.getByLabelText("Pending, 0.5")).toBeOnTheScreen();
    expect(vacation.getByLabelText("Carried in, 0")).toBeOnTheScreen();
  });

  it("charts the first allowance only and draws another one's months on Show months", async () => {
    await renderMember();
    await screen.findByTestId("member-report");

    expect(screen.getAllByTestId(/^quota-chart-VACATION-col-\d+$/)).toHaveLength(12);
    expect(screen.queryByTestId("allowance-VACATION-expand")).toBeNull();
    expect(screen.queryByTestId(/^quota-chart-SICK_DAY/)).toBeNull();
    const expand = screen.getByTestId("allowance-SICK_DAY-expand");
    expect(expand).toHaveProp("accessibilityLabel", "Show months, Sick day");

    await fireEvent.press(expand);

    expect(screen.getAllByTestId(/^quota-chart-SICK_DAY-col-\d+$/)).toHaveLength(12);
    expect(screen.getByTestId("quota-chart-SICK_DAY-col-8")).toHaveProp(
      "accessibilityLabel",
      "November 2025: 1 used, 0 pending"
    );
    expect(screen.queryByTestId("allowance-SICK_DAY-expand")).toBeNull();
  });

  it("opens a month's approved and pending days without even pace across two years", async () => {
    await renderMember();
    await screen.findByTestId("member-report");
    await layOut("quota-chart-VACATION");

    const december = screen.getByTestId("quota-chart-VACATION-col-9");
    expect(december).toHaveProp("accessibilityLabel", "December 2025: 2 used, 1 pending");
    expect(screen.queryByTestId("quota-chart-VACATION-guide")).toBeNull();

    await fireEvent.press(december);

    const callout = within(screen.getByTestId("quota-chart-VACATION-tip", HIDDEN));
    expect(callout.getByText("December 2025", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Approved", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("2", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Pending", HIDDEN)).toBeOnTheScreen();
    expect(callout.queryByText("Even pace", HIDDEN)).toBeNull();

    await fireEvent.press(december);

    expect(screen.queryByTestId("quota-chart-VACATION-tip", HIDDEN)).toBeNull();
  });

  it("draws the even-pace line on a calendar year and gives it in the callout", async () => {
    mockParams.period = "2026";

    await renderMember();
    await screen.findByTestId("member-report");
    await layOut("quota-chart-VACATION");

    expect(screen.getByTestId("quota-chart-VACATION-guide")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("quota-chart-VACATION-col-1"));
    let callout = within(screen.getByTestId("quota-chart-VACATION-tip", HIDDEN));
    expect(callout.getByText("February 2026", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("1.5", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("0.5", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("Even pace", HIDDEN)).toBeOnTheScreen();
    expect(callout.getByText("1.8", HIDDEN)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("quota-chart-VACATION-col-6"));
    callout = within(screen.getByTestId("quota-chart-VACATION-tip", HIDDEN));
    expect(callout.getByText("July 2026", HIDDEN)).toBeOnTheScreen();
    expect(callout.queryByText("Pending", HIDDEN)).toBeNull();
  });

  it("says none taken or booked for an allowance with nothing in the window", async () => {
    mockParams.period = "2026";

    await renderMember();
    await screen.findByTestId("member-report");
    await fireEvent.press(screen.getByTestId("allowance-SICK_DAY-expand"));

    const sick = within(screen.getByTestId("allowance-SICK_DAY"));
    expect(sick.getByText("None taken or booked in these months.")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^quota-chart-SICK_DAY/)).toBeNull();
  });

  it("says Loading the months while the prior year is outstanding, with the figures shown", async () => {
    answer({ members: { 2025: "hold" } });

    await renderMember();
    await screen.findByTestId("member-report");

    const vacation = within(screen.getByTestId("allowance-VACATION"));
    expect(vacation.getByText("Loading the months")).toBeOnTheScreen();
    expect(vacation.getByLabelText("Used, 1.5")).toBeOnTheScreen();
    expect(screen.queryByTestId(/^quota-chart-VACATION/)).toBeNull();

    await act(async () => {
      for (const release of held.splice(0)) release();
    });

    await waitFor(() =>
      expect(screen.getAllByTestId(/^quota-chart-VACATION-col-\d+$/)).toHaveLength(12)
    );
  });

  it("shows the incomplete note above the cards when the prior year fails, and the chart", async () => {
    answer({ members: { 2025: { status: 500, body: { message: "Down" } } } });

    await renderMember();

    expect(await screen.findByTestId("report-incomplete", {}, { timeout: 5000 })).toHaveTextContent(
      /2025 didn't load/
    );
    expect(screen.getAllByTestId(/^quota-chart-VACATION-col-\d+$/)).toHaveLength(12);

    answer();
    await fireEvent.press(screen.getByTestId("report-incomplete-retry"));

    await waitFor(() => expect(screen.queryByTestId("report-incomplete")).toBeNull());
  });

  it("shows each group's quotas from the summary, the group defaults without a quota row", async () => {
    mockParams.userId = "u-erin";
    mockParams.period = "2026";
    answer({ scope: ownerScope, member: (year) => ({ ...erinOnDefaults, year }) });

    await renderMember();
    await screen.findByTestId("member-report");

    expect(within(screen.getByTestId("member-quotas")).getByText("2026")).toBeOnTheScreen();
    const group = within(screen.getByTestId("quota-group-g-support"));
    expect(group.getByText("Dev Support")).toBeOnTheScreen();
    expect(group.getByLabelText("Vacation days, 25")).toBeOnTheScreen();
    expect(group.getByLabelText("Carried over from last year, 0")).toBeOnTheScreen();
    expect(group.getByLabelText("Home office days, 10")).toBeOnTheScreen();
    expect(group.queryByText("Sick days")).toBeNull();
  });

  it("shows the sick days where the group meters them, from the summary", async () => {
    mockParams.period = "2026";

    await renderMember();
    await screen.findByTestId("member-report");

    const group = within(screen.getByTestId("quota-group-g-team"));
    expect(group.getByText("Dev Team")).toBeOnTheScreen();
    expect(group.getByLabelText("Vacation days, 22")).toBeOnTheScreen();
    expect(group.getByLabelText("Home office days, 0")).toBeOnTheScreen();
    expect(group.getByLabelText("Sick days, 5")).toBeOnTheScreen();
  });

  it("shows four bookings latest first with status and note, then Show all and Show fewer", async () => {
    mockParams.period = "2026";

    await renderMember();
    await screen.findByTestId("member-report");

    const bookings = within(screen.getByTestId("member-bookings"));
    expect(bookings.getByText("Bookings")).toBeOnTheScreen();
    expect(bookings.getByText("5 in 2026")).toBeOnTheScreen();
    const rows = () =>
      bookings
        .getAllByLabelText(/, (Approved|Pending|Rejected)$/)
        .map((row) => row.props.accessibilityLabel as string);
    expect(rows()).toEqual([
      "1-30 Jul, Vacation, Summer, 22 days, Approved",
      "20 Feb, Vacation, 0.5 days, Pending",
      "10 Feb, Sick day, 1 day, Approved",
      "2-3 Feb, Vacation, Ski trip, 1.5 days, Approved",
    ]);
    expect(bookings.getByText("Pending")).toBeOnTheScreen();
    expect(bookings.getByText("Vacation, Ski trip")).toBeOnTheScreen();

    const more = screen.getByTestId("member-bookings-more");
    expect(more).toHaveProp("accessibilityLabel", "Show all 5");
    expect(more).toHaveProp("accessibilityState", { expanded: false });
    await fireEvent.press(more);

    expect(rows()).toHaveLength(5);
    expect(rows()[4]).toBe("19-23 Jan, Vacation, Release week, 5 days, Rejected");
    expect(bookings.getByText("Rejected")).toBeOnTheScreen();
    expect(screen.getByTestId("member-bookings-more")).toHaveProp(
      "accessibilityLabel",
      "Show fewer"
    );

    await fireEvent.press(screen.getByTestId("member-bookings-more"));

    expect(rows()).toHaveLength(4);
  });

  it("shows three changes by a person, a deleted account and Flexi Day, then Show all", async () => {
    mockParams.period = "2026";

    await renderMember();
    await screen.findByTestId("member-report");

    const changes = within(screen.getByTestId("member-changes"));
    expect(changes.getByText("Change history")).toBeOnTheScreen();
    expect(changes.getByText("Vacation days changed from 20 to 22")).toBeOnTheScreen();
    expect(changes.getByText("12 Jan 2026, by Olivia Owner")).toBeOnTheScreen();
    expect(changes.getByText("Carried over days changed from 2 to 0")).toBeOnTheScreen();
    expect(changes.getByText(/^\d+ \w{3} 202\d, by a deleted account$/)).toBeOnTheScreen();
    expect(changes.getByText("2026 quotas created from 2025")).toBeOnTheScreen();
    expect(changes.getByText(/^\d+ \w{3} 202\d, by Flexi Day$/)).toBeOnTheScreen();
    expect(changes.queryByText("Sick days changed from 3 to 5")).toBeNull();

    const more = screen.getByTestId("member-changes-more");
    expect(more).toHaveProp("accessibilityLabel", "Show all 4");
    await fireEvent.press(more);

    expect(changes.getByText("Sick days changed from 3 to 5")).toBeOnTheScreen();
    expect(screen.getByTestId("member-changes-more")).toHaveProp(
      "accessibilityLabel",
      "Show fewer"
    );
  });

  it("says so when the person has no bookings and no changes", async () => {
    mockParams.userId = "u-erin";
    mockParams.period = "2026";
    answer({ scope: ownerScope, member: (year) => memberReport({ year }) });

    await renderMember();
    await screen.findByTestId("member-report");

    const bookings = within(screen.getByTestId("member-bookings"));
    expect(bookings.getByText("Nothing booked in 2026.")).toBeOnTheScreen();
    expect(bookings.queryByText(/in 2026$/)).toBeNull();
    const changes = within(screen.getByTestId("member-changes"));
    expect(changes.getByText("No changes to the allowance in 2026.")).toBeOnTheScreen();
    expect(screen.queryByTestId("member-bookings-more")).toBeNull();
    expect(screen.queryByTestId("member-changes-more")).toBeNull();
  });

  it("shows Not in your report when the person's read answers 403", async () => {
    answer({ members: { 2025: { status: 403 }, 2026: { status: 403, body: { message: "No" } } } });

    await renderMember();

    expect(await screen.findByTestId("report-forbidden")).toBeOnTheScreen();
    expect(screen.getByText("Not in your report")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "This person isn't in a group whose report you can see, or their account no longer exists."
      )
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("report-loading")).toBeNull();
    expect(screen.queryByTestId("member-report")).toBeNull();
    expect(screen.getByTestId("stack-back")).toHaveProp("accessibilityLabel", "Report");
  });

  it("shows Not in your report when the person's read answers 404", async () => {
    mockParams.period = "2026";
    answer({ members: { 2026: { status: 404, body: { message: "Member not found" } } } });

    await renderMember();

    expect(await screen.findByTestId("report-forbidden")).toBeOnTheScreen();
    expect(screen.getByText("Not in your report")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-loading")).toBeNull();
    expect(screen.queryByTestId("report-offline")).toBeNull();
    expect(screen.queryByTestId("member-report")).toBeNull();
  });

  it("shows no Edit quota anywhere while every group says the viewer can edit quotas", async () => {
    mockParams.userId = "u-erin";
    mockParams.period = "2026";
    const editable = scopeGroup({
      groupId: "g-support",
      groupName: "Dev Support",
      canEditQuotas: true,
    });
    expect(ownerScope.groups.every((group) => group.canEditQuotas)).toBe(true);
    answer({
      scope: ownerScope,
      member: (year) =>
        memberReport({
          year,
          groups: [editable],
          quotas: [
            {
              userId: "u-erin",
              groupId: "g-support",
              vacationDays: 20,
              homeOfficeDays: 0,
              carriedOverDays: 0,
            },
          ],
          summary: [summaryRow({ userId: "u-erin", groupId: "g-support", yearQuota: 20 })],
          bookings: crossMember2026.bookings,
          changes: crossMember2026.changes,
        }),
    });

    await renderMember();
    await screen.findByTestId("member-report");
    expect(screen.getByTestId("quota-group-g-support")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("member-bookings-more"));
    await fireEvent.press(screen.getByTestId("member-changes-more"));

    expect(screen.queryByText(/edit/i)).toBeNull();
    expect(screen.queryByLabelText(/edit/i)).toBeNull();
    expect(screen.queryAllByTestId(/edit/i)).toHaveLength(0);
  });

  it("reads the person's report again when the screen comes back into focus", async () => {
    mockParams.period = "2026";
    await renderMember();
    await screen.findByTestId("member-report");
    await act(async () => mockFocus());

    await act(async () => mockFocus());

    await waitFor(() => expect(urlsOf("/api/reports/members/")).toHaveLength(2));
    expect(urlsOf("/api/reports/scope")).toHaveLength(2);
  });
  it("shows Can't reach the server with Retry when the first read fails with nothing kept", async () => {
    answer({ members: { 2025: "offline", 2026: "offline" } });

    await renderMember();

    expect(await screen.findByTestId("report-offline", {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.getByText("Can't reach the server")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-loading")).toBeNull();
    expect(screen.queryByTestId("member-period")).toBeNull();
    expect(screen.getByTestId("stack-back")).toBeOnTheScreen();

    answer();
    await fireEvent.press(screen.getByTestId("report-retry"));

    expect(await screen.findByTestId("member-report")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-offline")).toBeNull();
  });

  it("keeps the person's report with the kept answer's time when a reread fails", async () => {
    mockParams.period = "2026";
    await renderMember();
    await screen.findByTestId("member-report");

    answer({ members: { 2026: "offline" } });
    await act(async () => mockFocus());
    await act(async () => mockFocus());

    const notice = await screen.findByTestId("report-stale", {}, { timeout: 5000 });
    expect(notice).toHaveTextContent("Offline. Showing the report as of 10:00.Retry");
    expect(within(screen.getByTestId("member-report")).getByTestId("report-stale")).toBe(notice);
    expect(screen.getByTestId("allowance-VACATION")).toBeOnTheScreen();
    expect(screen.getByTestId("member-bookings")).toBeOnTheScreen();

    answer();
    await fireEvent.press(screen.getByTestId("report-stale-retry"));

    await waitFor(() => expect(screen.queryByTestId("report-stale")).toBeNull());
    expect(screen.getByTestId("allowance-VACATION")).toBeOnTheScreen();
  });

  it("reads the person's report again by itself when the connection comes back", async () => {
    mockParams.period = "2026";
    await renderMember();
    await screen.findByTestId("member-report");
    answer({ members: { 2026: "offline" } });
    await act(async () => onlineManager.setOnline(false));
    await act(async () => mockFocus());
    await act(async () => mockFocus());
    await screen.findByTestId("report-stale", {}, { timeout: 5000 });
    const reads = urlsOf("/api/reports/members/").length;

    answer();
    await act(async () => onlineManager.setOnline(true));

    await waitFor(() => expect(screen.queryByTestId("report-stale")).toBeNull());
    expect(urlsOf("/api/reports/members/").length).toBeGreaterThan(reads);
  });

  it("keeps the period chip above Can't reach the server when a period change finds nothing", async () => {
    mockParams.period = "2026";
    await renderMember();
    await screen.findByTestId("member-report");

    answer({ members: { 2025: "offline" } });
    await fireEvent.press(screen.getByTestId("member-period"));
    await fireEvent.press(screen.getByTestId("member-period-sheet-2025"));

    expect(await screen.findByTestId("report-offline", {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.getByTestId("member-period")).toHaveProp("accessibilityLabel", "Period, 2025");

    await fireEvent.press(screen.getByTestId("member-period"));
    await fireEvent.press(screen.getByTestId("member-period-sheet-2026"));

    expect(await screen.findByTestId("member-report")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-offline")).toBeNull();
  });

  it("renders the person in Czech with month names, plurals and half days with a comma", async () => {
    mockLanguage = "cs";
    answer({
      member: (year) => ({
        ...crossMember(year),
        summary: [
          summaryRow({ userId: "u-bob", yearQuota: 30, usedToDate: 2.5 }),
          summaryRow({ userId: "u-bob", vacationType: "SICK_DAY", yearQuota: 5 }),
        ],
      }),
    });

    await renderMember();

    const member = await screen.findByTestId("member-report");
    const vacation = within(screen.getByTestId("allowance-VACATION"));
    expect(vacation.getByText("Dovolená")).toBeOnTheScreen();
    expect(vacation.getByLabelText("27,5 dne zbývá z 30")).toBeOnTheScreen();
    expect(vacation.getByLabelText("Vybráno, 2,5")).toBeOnTheScreen();
    expect(vacation.getByText("Bře 2025 až Úno 2026")).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByTestId("quota-chart-VACATION-col-11")).toHaveProp(
        "accessibilityLabel",
        "Únor 2026: 1,5 vybráno, 0,5 ke schválení"
      )
    );
    expect(screen.getByLabelText("5 dní zbývá z 5")).toBeOnTheScreen();
    expect(screen.getByTestId("member-period")).toHaveProp(
      "accessibilityLabel",
      "Období, Posledních 12 měsíců"
    );
    expect(within(member).getByText("Dny dovolené")).toBeOnTheScreen();
    expect(within(member).getByText("5 v roce 2026")).toBeOnTheScreen();
    expect(screen.getByTestId("member-bookings-more")).toHaveTextContent("Zobrazit všech 5");
    expect(screen.getByTestId("member-changes-more")).toHaveTextContent("Zobrazit všechny 4");
    expect(screen.getByTestId("stack-back")).toHaveProp("accessibilityLabel", "Report");
  });
  it("puts a testID and a label on every pressable of the member screen, opened all the way", async () => {
    mockParams.period = "2026";
    await renderMember();
    await screen.findByTestId("member-report");
    await layOut("quota-chart-VACATION");
    await fireEvent.press(screen.getByTestId("allowance-SICK_DAY-expand"));
    await fireEvent.press(screen.getByTestId("member-bookings-more"));
    await fireEvent.press(screen.getByTestId("member-changes-more"));
    await fireEvent.press(screen.getByTestId("quota-chart-VACATION-col-1"));
    expect(screen.getByTestId("quota-chart-VACATION-tip", HIDDEN)).toBeTruthy();

    expect(pressableProblems(screen.toJSON())).toEqual([]);

    await fireEvent.press(screen.getByTestId("member-period"));
    expect(screen.getByTestId("member-period-sheet")).toBeOnTheScreen();
    expect(pressableProblems(screen.toJSON())).toEqual([]);
  });

  it("puts a testID and a label on every pressable of Can't reach the server", async () => {
    answer({ members: { 2025: "offline", 2026: "offline" } });
    await renderMember();
    await screen.findByTestId("report-offline", {}, { timeout: 5000 });

    expect(pressableProblems(screen.toJSON())).toEqual([]);
  });
});
