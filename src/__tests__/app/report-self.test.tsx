import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import ReportRoute from "@/app/report";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { ReportScope } from "@/lib/report";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import type { Viewer } from "@/lib/viewer/use-viewer";
import {
  CROSS_YEAR_TODAY,
  crossOverview,
  crossScope,
  selfMember,
  selfScope,
} from "@/test-support/report";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockStoreCalls: string[] = [];
let mockViewer: Viewer | null = null;
let mockLanguage = "en";
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
  useNavigation: () => ({ canGoBack: () => true }),
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/viewer/use-viewer", () => ({ useViewer: () => mockViewer }));
// Every export of the local store records its call, so a test can prove nothing read from it.
jest.mock(
  "@/lib/local-store",
  () =>
    new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === "__esModule") return true;
          if (typeof key !== "string" || key === "then") return undefined;
          return (..._args: unknown[]) => {
            mockStoreCalls.push(key);
          };
        },
      }
    )
);
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: mockLanguage }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

const OLIVIA: Viewer = {
  id: "u-olivia",
  name: "Olivia Owner",
  email: "olivia@dev.local",
  twoFactorEnabled: false,
};

type Reply = { status: number; body?: unknown } | "offline";

const reply = (status: number, body: unknown) => ({ status, json: async () => body });

function answer({
  scope = selfScope,
  members = {},
}: { scope?: ReportScope; members?: Record<number, Reply> } = {}) {
  mockFetch.mockImplementation(async (url: string) => {
    const year = Number(new URL(url).searchParams.get("year"));
    if (url.includes("/api/reports/scope")) return reply(200, scope);
    if (url.includes("/api/reports/overview")) return reply(200, crossOverview(year));
    if (url.includes("/api/reports/members/u-olivia")) {
      const pick = members[year] ?? { status: 200 };
      if (pick === "offline") throw new TypeError("Network request failed");
      return reply(pick.status, pick.body ?? selfMember(year));
    }
    return reply(404, {});
  });
}

const urlsOf = (path: string) =>
  mockFetch.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(path));

async function renderReport() {
  await render(
    <RootRouteProvider route="signed-in">
      <TranslationProvider>
        <ReportRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreCalls.length = 0;
  mockViewer = OLIVIA;
  mockLanguage = "en";
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

describe("Report self view", () => {
  it("opens straight on Your leave for the viewer, with the period chip as the only control", async () => {
    await renderReport();

    const self = await screen.findByTestId("report-self");
    expect(within(screen.getByTestId("report")).getByText("Report")).toBeOnTheScreen();
    expect(within(self).getByText("Your leave")).toBeOnTheScreen();
    expect(within(self).getByText("Olivia Owner, Design Guild")).toBeOnTheScreen();
    expect(screen.getByTestId("member-period")).toHaveProp(
      "accessibilityLabel",
      "Period, Last 12 months"
    );
    expect(screen.queryByTestId("report-period")).toBeNull();
    expect(screen.queryByTestId("report-groups")).toBeNull();
    expect(screen.queryByTestId("report-members")).toBeNull();
    expect(screen.queryAllByTestId(/^report-type-/)).toEqual([]);
    expect(screen.queryByTestId("report-overview")).toBeNull();
    expect(screen.queryByTestId("report-forbidden")).toBeNull();
  });

  it("shows the viewer's own allowance, quotas and bookings", async () => {
    await renderReport();
    await screen.findByTestId("report-self");

    await waitFor(() =>
      expect(screen.getByTestId("allowance-VACATION-left")).toHaveProp(
        "accessibilityLabel",
        "25 days left of 25"
      )
    );
    expect(screen.getByTestId("quota-group-g-design")).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("member-bookings")).getByText("Nothing booked in 2026.")
    ).toBeOnTheScreen();
  });

  it("reads the viewer's own report for both years of the window and never the overview", async () => {
    await renderReport();
    await screen.findByTestId("report-self");

    await waitFor(() => expect(urlsOf("/api/reports/members/")).toHaveLength(2));
    expect(urlsOf("/api/reports/members/").sort()).toEqual([
      expect.stringMatching(/\/api\/reports\/members\/u-olivia\?year=2025$/),
      expect.stringMatching(/\/api\/reports\/members\/u-olivia\?year=2026$/),
    ]);
    expect(urlsOf("/api/reports/overview")).toEqual([]);
  });

  it("switches the window from the period chip without leaving the screen", async () => {
    await renderReport();
    await screen.findByTestId("report-self");

    await fireEvent.press(screen.getByTestId("member-period"));
    await fireEvent.press(screen.getByTestId("member-period-sheet-2025"));

    await waitFor(() =>
      expect(screen.getByTestId("member-period")).toHaveProp("accessibilityLabel", "Period, 2025")
    );
    await waitFor(() =>
      expect(within(screen.getByTestId("member-bookings")).getByText("1 in 2025")).toBeOnTheScreen()
    );
    expect(urlsOf("/api/reports/overview")).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("offers Retry, never Not in your report, when the viewer's read answers 403", async () => {
    answer({ members: { 2026: { status: 403, body: { message: "Forbidden" } } } });

    await renderReport();

    expect(await screen.findByTestId("report-offline")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-forbidden")).toBeNull();
    expect(screen.queryByText("Not in your report")).toBeNull();

    answer();
    await fireEvent.press(screen.getByTestId("report-retry"));

    expect(await screen.findByTestId("report-self")).toBeOnTheScreen();
  });

  it("offers Retry when the viewer's first read fails, and loads on Retry", async () => {
    answer({ members: { 2026: "offline" } });

    await renderReport();

    expect(await screen.findByTestId("report-offline", {}, { timeout: 5000 })).toBeOnTheScreen();

    answer();
    await fireEvent.press(screen.getByTestId("report-retry"));

    expect(await screen.findByTestId("report-self")).toBeOnTheScreen();
  });

  it("reads the viewer's report again when the screen comes back into focus", async () => {
    await renderReport();
    await screen.findByTestId("report-self");
    await waitFor(() => expect(urlsOf("year=2026")).toHaveLength(1));

    await act(async () => mockFocus());
    await act(async () => mockFocus());

    await waitFor(() => expect(urlsOf("year=2026")).toHaveLength(2));
  });

  it("takes the viewer from the viewer hook alone, reading nothing from the local store", async () => {
    await renderReport();
    await screen.findByTestId("report-self");
    await waitFor(() => expect(urlsOf("/api/reports/members/")).toHaveLength(2));

    expect(mockStoreCalls).toEqual([]);
  });

  it("stays on the skeleton and reads no report while the viewer is unknown", async () => {
    mockViewer = null;

    await renderReport();

    await waitFor(() => expect(urlsOf("/api/reports/scope")).toHaveLength(1));
    await act(async () => undefined);
    expect(screen.getByTestId("report-loading")).toBeOnTheScreen();
    expect(urlsOf("/api/reports/members/")).toEqual([]);
    expect(urlsOf("/api/reports/overview")).toEqual([]);
  });

  it("heads the self view in Czech", async () => {
    mockLanguage = "cs";

    await renderReport();

    const self = await screen.findByTestId("report-self");
    expect(within(self).getByText("Vaše volno")).toBeOnTheScreen();
    expect(within(self).getByText("Olivia Owner, Design Guild")).toBeOnTheScreen();
  });
});

describe("Report with a mixed scope", () => {
  beforeEach(() => answer({ scope: crossScope }));

  it("shows the overview with only the viewer's own row in their self group", async () => {
    await renderReport();

    const design = await screen.findByTestId("people-g-design");
    expect(within(design).getByText("Design Guild")).toBeOnTheScreen();
    expect(within(design).getByTestId("member-row-u-olivia")).toBeOnTheScreen();
    expect(within(design).queryAllByTestId(/^member-row-/)).toHaveLength(1);
    expect(screen.getByTestId("report-period")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-self")).toBeNull();
    expect(urlsOf("/api/reports/members/")).toEqual([]);
  });

  it("pushes the viewer's own member screen from their row", async () => {
    await renderReport();

    await fireEvent.press(await screen.findByTestId("member-row-u-olivia"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/report/[userId]",
      params: { userId: "u-olivia", period: "rolling" },
    });
  });
});
