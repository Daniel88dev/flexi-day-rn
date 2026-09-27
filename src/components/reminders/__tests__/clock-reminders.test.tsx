import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

import { ClockReminders } from "@/components/reminders/clock-reminders";
import { TranslationProvider } from "@/i18n/use-translation";
import { useSyncStatus } from "@/lib/local-store";
import { queryClient } from "@/lib/query";
import { reminderPrefs } from "@/lib/reminders";
import { clearClockReminders } from "@/lib/reminders/device";
import { attendance, workingMonth, session } from "@/test-support/attendance";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ useSyncStatus: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const notifications = jest.requireActual("expo-notifications") as {
  __scheduled: Map<string, { identifier: string; content: { title: string; data: unknown } }>;
  getPermissionsAsync: jest.Mock;
  useLastNotificationResponse: jest.Mock;
  clearLastNotificationResponse: jest.Mock;
};
const syncStatus = useSyncStatus as jest.Mock;

const GRANTED = { status: "granted", granted: true, canAskAgain: true, ios: { status: 2 } };
const DENIED = { status: "denied", granted: false, canAskAgain: false, ios: { status: 1 } };
const UNDETERMINED = {
  status: "undetermined",
  granted: false,
  canAskAgain: true,
  ios: { status: 0 },
};

// Monday 28 September 2026, 07:00 on the phone.
const NOW = new Date(2026, 8, 28, 7, 0).getTime();

let current: unknown;

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  notifications.__scheduled.clear();
  notifications.getPermissionsAsync.mockResolvedValue(GRANTED);
  notifications.useLastNotificationResponse.mockReturnValue(null);
  syncStatus.mockReturnValue({ lastPulledAt: null });
  reminderPrefs.clear();
  current = attendance({ businessDate: "2026-09-28" });
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/api/attendance/current")) {
      return current === 404 ? answer(404, { message: "No Employment" }) : answer(200, current);
    }
    const month = Number(new URL(url).searchParams.get("month"));
    return answer(200, workingMonth(2026, month));
  });
});

afterEach(async () => {
  queryClient.clear();
  jest.restoreAllMocks();
});

async function renderReminders() {
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <ClockReminders />
      </TranslationProvider>
    </QueryClientProvider>
  );
  const reads = (path: string) =>
    mockFetch.mock.calls.filter(([url]) => String(url).includes(path)).length;
  await waitFor(() => {
    expect(notifications.getPermissionsAsync).toHaveBeenCalled();
    expect(reads("/api/attendance/current")).toBeGreaterThan(0);
    if (current !== 404) expect(reads("/api/attendance/month")).toBeGreaterThanOrEqual(2);
    expect(queryClient.isFetching()).toBe(0);
  });
  await act(async () => undefined);
  return view;
}

const scheduledIds = () => [...notifications.__scheduled.keys()].sort();

describe("ClockReminders", () => {
  it("schedules clock-in reminders through the end of next month once the switch is on", async () => {
    reminderPrefs.save({
      clockIn: { enabled: true, time: "08:00", weekdays: null },
      clockOut: { enabled: true },
    });

    await renderReminders();

    await waitFor(() => expect(scheduledIds()).toHaveLength(3 + 22));
    expect(scheduledIds()[0]).toBe("clock-in:2026-09-28");
    expect(notifications.__scheduled.get("clock-in:2026-09-28")?.content).toMatchObject({
      title: "Clock in",
      body: "Starting work? Clock in if you haven't yet.",
      data: { url: "/clock" },
    });
  });

  it("schedules the clock-out reminder while a session is open", async () => {
    const open = session({ businessDate: "2026-09-28", startedAt: new Date(NOW).toISOString() });
    current = attendance({ businessDate: "2026-09-28", openSession: open, sessions: [open] });

    await renderReminders();

    await waitFor(() => expect(scheduledIds()).toEqual(["clock-out"]));
    expect(notifications.__scheduled.get("clock-out")?.content).toMatchObject({
      title: "Clock out",
    });
  });

  it("leaves nothing scheduled after the Signed-out wipe, though the shell is still mounted", async () => {
    const open = session({ businessDate: "2026-09-28", startedAt: new Date(NOW).toISOString() });
    current = attendance({ businessDate: "2026-09-28", openSession: open, sessions: [open] });
    // Settings of its own, so the wipe's reset to the defaults renders the planner again.
    reminderPrefs.save({
      clockIn: { enabled: false, time: "07:30", weekdays: [1, 2] },
      clockOut: { enabled: true },
    });
    await renderReminders();
    await waitFor(() => expect(scheduledIds()).toEqual(["clock-out"]));

    // The wipe's own step; the query cache and this component outlive it for a moment.
    await act(async () => {
      await clearClockReminders();
    });
    await act(async () => undefined);

    expect(scheduledIds()).toEqual([]);
  });

  it("reads the month a session opened before midnight on the 1st belongs to", async () => {
    const nowOnFirst = new Date(2026, 9, 1, 2, 30).getTime();
    (Date.now as jest.Mock).mockReturnValue(nowOnFirst);
    const open = session({
      businessDate: "2026-09-30",
      startedAt: new Date(nowOnFirst - 2 * 3_600_000).toISOString(),
    });
    current = attendance({ businessDate: "2026-10-01", openSession: open, sessions: [] });

    await renderReminders();

    const months = mockFetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes("/api/attendance/month"))
      .map((url) => new URL(url).searchParams.get("month"));
    expect(new Set(months)).toEqual(new Set(["9", "10", "11"]));
    await waitFor(() => expect(scheduledIds()).toEqual(["clock-out"]));
  });

  it("cancels every reminder once /current answers 404", async () => {
    notifications.__scheduled.set("clock-in:2026-09-29", {
      identifier: "clock-in:2026-09-29",
      content: { title: "Clock in", data: { fireAt: 1 } },
    });
    current = 404;

    await renderReminders();

    await waitFor(() => expect(scheduledIds()).toEqual([]));
  });

  it("reads this month and next again after a finished sync pull", async () => {
    syncStatus.mockReturnValue({ lastPulledAt: "2026-09-28T04:59:00.000Z" });
    const view = await renderReminders();
    const monthReads = () =>
      mockFetch.mock.calls.filter(([url]) => String(url).includes("/api/attendance/month"));
    await waitFor(() => expect(monthReads()).toHaveLength(2));

    syncStatus.mockReturnValue({ lastPulledAt: "2026-09-28T05:00:00.000Z" });
    await view.rerender(
      <QueryClientProvider client={queryClient}>
        <TranslationProvider>
          <ClockReminders />
        </TranslationProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(monthReads()).toHaveLength(4));
    expect(monthReads().map(([url]) => new URL(String(url)).searchParams.get("month"))).toEqual([
      "9",
      "10",
      "9",
      "10",
    ]);
  });

  it("schedules nothing while iOS refuses notifications", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(DENIED);
    reminderPrefs.save({
      clockIn: { enabled: true, time: "08:00", weekdays: null },
      clockOut: { enabled: true },
    });

    await renderReminders();
    await act(async () => undefined);

    expect(scheduledIds()).toEqual([]);
  });

  it("opens the Clock sheet from a tapped clock reminder", async () => {
    notifications.useLastNotificationResponse.mockReturnValue({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: { request: { identifier: "clock-in:2026-09-28" } },
    });

    await renderReminders();

    expect(router.push).toHaveBeenCalledWith("/clock");
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it("opens the explainer once while iOS has not been asked", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(UNDETERMINED);

    const first = await renderReminders();
    await first.unmount();
    await renderReminders();

    const opened = (router.push as jest.Mock).mock.calls.filter(
      ([href]) => href === "/notifications-intro"
    );
    expect(opened).toHaveLength(1);
  });
});
