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
  memberReport,
  ownerScope,
  scopeGroup,
  summaryRow,
} from "@/test-support/report";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockParams: { userId: string; period?: string } = { userId: "u-bob" };
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
  useLocalSearchParams: () => mockParams,
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

  it("shows no Edit quota anywhere while every group says the viewer can edit quotas", async () => {
    mockParams.userId = "u-erin";
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
        }),
    });

    await renderMember();
    await screen.findByTestId("member-report");

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
});
