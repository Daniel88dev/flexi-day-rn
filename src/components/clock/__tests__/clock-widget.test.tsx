import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { toast } from "sonner-native";

import { ClockWidget } from "@/components/clock/clock-widget";
import { TranslationProvider } from "@/i18n/use-translation";
import type { AttendanceState } from "@/lib/attendance";
import { qk } from "@/lib/query/keys";
import { attendance, session } from "@/test-support/attendance";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();

// The factory runs before `mockFetch` is assigned, so it reaches it through a closure.
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
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, Highest: 6 },
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const answer = (status: number, body: unknown) => ({ status, json: async () => body });

type Route = { method: string; path: string };

type Read = AttendanceState | { status: number };

/** A backend that answers `/current` from `reads` in turn, the last one for good, and each write with `write`. */
function serve(reads: Read[], write: (route: Route) => unknown) {
  const queue = [...reads];
  mockFetch.mockImplementation(async (url: string, init: { method?: string }) => {
    const route = { method: init.method ?? "GET", path: new URL(url).pathname };
    if (route.path === "/api/attendance/current") {
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      return "status" in next ? answer(next.status, {}) : answer(200, next);
    }
    return write(route);
  });
}

function posts(): { path: string; body: unknown }[] {
  return mockFetch.mock.calls
    .filter(([, init]) => init.method === "POST")
    .map(([url, init]) => ({ path: new URL(url).pathname, body: JSON.parse(init.body) }));
}

let client: QueryClient;

async function renderWidget(cached?: AttendanceState) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30_000 } },
  });
  if (cached) client.setQueryData(qk.attendanceState(), cached);
  await render(
    <TranslationProvider>
      <QueryClientProvider client={client}>
        <ClockWidget onNavigate={jest.fn()} />
      </QueryClientProvider>
    </TranslationProvider>
  );
}

const OPEN = session({ startedAt: new Date(Date.now() - 5 * 60_000).toISOString() });
const OUT = attendance();
const IN = attendance({ openSession: OPEN, sessions: [OPEN] });

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => jest.clearAllMocks());

describe("ClockWidget", () => {
  it("reads /current again on mount, however fresh the cached answer it shows meanwhile", async () => {
    serve([IN], () => answer(500, {}));

    await renderWidget(OUT);

    expect(await screen.findByText("Clocked in")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("clocks in, then shows the state the re-read confirms, with haptics on tap and success", async () => {
    serve([OUT, IN], () => answer(201, OPEN));
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("Clocked in")).toBeTruthy();
    expect(posts()).toEqual([
      { path: "/api/attendance/clock-in", body: { organizationId: "org-1" } },
    ]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("shows a network failure with Retry and an error haptic, leaving the state as read", async () => {
    serve([OUT], () => Promise.reject(new TypeError("Network request failed")));
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("Retry")).toBeTruthy();
    expect(screen.getByText("Not clocked in")).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");

    await act(async () => fireEvent.press(screen.getByText("Retry")));
    expect(posts()).toHaveLength(2);
  });

  it("answers a clock-in that lost to a session opened elsewhere with the time it opened", async () => {
    serve([OUT, IN], () => answer(409, { errors: [{ message: "A session is already open" }] }));
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText(/^Clocked in since \d\d:\d\d$/)).toBeTruthy();
    expect(screen.queryByTestId("clock-in")).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");
  });

  it("keeps a notice on screen when the re-read after a 409 fails too", async () => {
    serve([OUT, { status: 500 }], () =>
      answer(409, { errors: [{ message: "A session is already open" }] })
    );
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("The server had a problem")).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
    expect(Haptics.notificationAsync).not.toHaveBeenCalledWith("warning");
  });

  it("answers a server fault on a write with the server notice, and reads again", async () => {
    serve([OUT, IN], () => answer(502, {}));
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("The server had a problem")).toBeTruthy();
    expect(screen.queryByText("Can't reach the server")).toBeNull();
    // The write may have landed after all; the re-read shows that it did.
    expect(screen.getByText("Clocked in")).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
  });

  it("keeps the actions live when a read meets a server fault", async () => {
    serve([{ status: 503 }], () => answer(201, OPEN));

    await renderWidget(OUT);

    await waitFor(() => expect(client.getQueryState(qk.attendanceState())?.status).toBe("error"));
    expect(screen.queryByTestId("clock-offline")).toBeNull();
    expect(screen.getByTestId("clock-in").props.accessibilityState?.disabled).toBe(false);
  });
});

describe("ClockWidget with location recorded", () => {
  const OUT_HERE = attendance({ locationEnabled: true });
  const IN_HERE = attendance({ locationEnabled: true, openSession: OPEN, sessions: [OPEN] });
  const located = jest.mocked(Location);
  const fix = (accuracy: number) =>
    ({ coords: { latitude: 50.0875, longitude: 14.4213, accuracy }, timestamp: 0 }) as never;

  let dismissed = true;
  let saveFails = false;

  function serveLocated(reads: AttendanceState[]) {
    serve(reads, (route) => {
      if (route.path === "/api/users/me/settings") {
        if (route.method === "PUT") {
          if (saveFails) return Promise.reject(new TypeError("Network request failed"));
          const [, init] = mockFetch.mock.calls.at(-1);
          dismissed = JSON.parse(init.body).attendanceLocationNoticeDismissed;
        }
        return answer(200, { attendanceLocationNoticeDismissed: dismissed });
      }
      if (route.path === "/api/attendance/clock-in") return answer(201, OPEN);
      const sent = posts().at(-1)!.body as { accuracy: number };
      return answer(200, { applied: true, accuracy: sent.accuracy });
    });
  }

  const locationPosts = () => posts().filter(({ path }) => path.endsWith("/location"));

  beforeEach(() => {
    dismissed = true;
    saveFails = false;
    located.hasServicesEnabledAsync.mockResolvedValue(true);
    located.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      ios: { accuracy: "full", scope: "whenInUse" },
    } as never);
    located.getLastKnownPositionAsync.mockResolvedValue(null);
    located.getCurrentPositionAsync.mockImplementation(async (options) =>
      fix(options?.accuracy === Location.Accuracy.Highest ? 6 : 65)
    );
  });

  it("sends the coarse and then the precise fix to the new session and says where it settled", async () => {
    serveLocated([OUT_HERE, IN_HERE]);
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("Clock-in location saved (±6\u00a0m)")).toBeTruthy();
    expect(locationPosts()).toEqual([
      {
        path: "/api/attendance/sessions/s1/location",
        body: { end: "IN", latitude: 50.0875, longitude: 14.4213, accuracy: 65 },
      },
      {
        path: "/api/attendance/sessions/s1/location",
        body: { end: "IN", latitude: 50.0875, longitude: 14.4213, accuracy: 6 },
      },
    ]);
  });

  it("finishes the clock-in without waiting for the location", async () => {
    located.requestForegroundPermissionsAsync.mockReturnValue(new Promise(() => undefined));
    serveLocated([OUT_HERE, IN_HERE]);
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("Clocked in")).toBeTruthy();
    expect(screen.getByTestId("clock-out").props.accessibilityState?.disabled).toBe(false);
    expect(screen.queryByTestId("clock-location")).toBeNull();
  });

  it("shows nothing and sends nothing when the person declines", async () => {
    located.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false } as never);
    serveLocated([OUT_HERE, IN_HERE]);
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("Clocked in")).toBeTruthy();
    await waitFor(() => expect(located.requestForegroundPermissionsAsync).toHaveBeenCalled());
    expect(located.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(locationPosts()).toEqual([]);
    expect(screen.queryByTestId("clock-location")).toBeNull();
  });

  it("asks nothing while the organization does not record location", async () => {
    serve([OUT, IN], () => answer(201, OPEN));
    await renderWidget();
    await screen.findByText("Not clocked in");

    await act(async () => fireEvent.press(screen.getByTestId("clock-in")));

    expect(await screen.findByText("Clocked in")).toBeTruthy();
    expect(located.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mockFetch.mock.calls.some(([url]) => String(url).includes("/me/settings"))).toBe(false);
  });

  it("shows the one-time notice once the settings answer, and Got it saves the dismissal", async () => {
    dismissed = false;
    serveLocated([OUT_HERE]);
    await renderWidget();

    expect(await screen.findByText("Your organization records where you clock")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Got it")));

    await waitFor(() => expect(screen.queryByTestId("clock-location-notice")).toBeNull());
    const put = mockFetch.mock.calls.find(([, init]) => init.method === "PUT");
    expect(new URL(put[0]).pathname).toBe("/api/users/me/settings");
    expect(JSON.parse(put[1].body)).toEqual({ attendanceLocationNoticeDismissed: true });
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it("keeps the notice with a line inside it when Got it does not save, and Got it tries again", async () => {
    dismissed = false;
    saveFails = true;
    serveLocated([OUT_HERE]);
    await renderWidget();
    await screen.findByText("Your organization records where you clock");

    await act(async () => fireEvent.press(screen.getByText("Got it")));

    expect(await screen.findByText("Couldn't save. Try again.")).toBeTruthy();
    expect(screen.getByTestId("clock-location-notice")).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();

    saveFails = false;
    await act(async () => fireEvent.press(screen.getByText("Got it")));

    await waitFor(() => expect(screen.queryByTestId("clock-location-notice")).toBeNull());
    const puts = mockFetch.mock.calls.filter(([, init]) => init.method === "PUT");
    expect(puts).toHaveLength(2);
  });

  it("leaves the notice out while the clock is locked", async () => {
    dismissed = false;
    serveLocated([attendance({ locationEnabled: true, active: false })]);
    await renderWidget();

    expect(await screen.findByTestId("clock-inactive")).toBeTruthy();
    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([url]) => String(url).includes("/me/settings"))).toBe(true)
    );
    expect(screen.queryByTestId("clock-location-notice")).toBeNull();
  });

  it("keeps the notice away for someone who dismissed it on the web", async () => {
    serveLocated([OUT_HERE]);
    await renderWidget();
    await screen.findByText("Not clocked in");

    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([url]) => String(url).includes("/me/settings"))).toBe(true)
    );
    expect(screen.queryByTestId("clock-location-notice")).toBeNull();
  });
});
