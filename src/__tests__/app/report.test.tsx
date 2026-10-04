import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import ReportRoute from "@/app/report";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { ReportScope } from "@/lib/report";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { ownerOverview, ownerScope, reportOverview, reportScope } from "@/test-support/report";
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

type Reply = { status: number; body?: unknown } | "offline";

const reply = (status: number, body: unknown) => ({ status, json: async () => body });

function answer({
  scope = { status: 200, body: ownerScope },
  overview = { status: 200, body: ownerOverview },
}: { scope?: Reply; overview?: Reply } = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    const pick = url.includes("/api/reports/scope")
      ? scope
      : url.includes("/api/reports/overview")
        ? overview
        : { status: 404, body: {} };
    if (pick === "offline") throw new TypeError("Network request failed");
    return reply(pick.status, pick.body);
  });
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

    const [url] = urlsOf("/api/reports/overview");
    expect(url).toMatch(/\/api\/reports\/overview\?year=2026$/);
    expect(new URL(url).searchParams.has("types")).toBe(false);
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
