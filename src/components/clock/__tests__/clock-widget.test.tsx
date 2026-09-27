import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import { ClockWidget } from "@/components/clock/clock-widget";
import { TranslationProvider } from "@/i18n/use-translation";
import type { AttendanceState } from "@/lib/attendance";
import { qk } from "@/lib/query/keys";
import { attendance, session } from "@/test-support/attendance";

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
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
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
