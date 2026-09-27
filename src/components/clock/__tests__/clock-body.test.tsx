import { fireEvent, render, screen } from "@testing-library/react-native";

import { ClockBody } from "@/components/clock/clock-widget";
import { TranslationProvider } from "@/i18n/use-translation";
import type { ClockAction, ClockView, LocationStatus, WriteNotice } from "@/lib/attendance";
import { openWebPage } from "@/lib/web";
import { attendance, pause, session } from "@/test-support/attendance";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("@/lib/web", () => ({
  WEB_PATHS: { privacy: "/privacy/" },
  openWebPage: jest.fn().mockResolvedValue(undefined),
}));

const NOW = new Date("2026-09-27T07:47:12.000Z").getTime();
const READ_AT = new Date("2026-09-27T07:41:00.000Z").getTime();

function ready(overrides: Parameters<typeof attendance>[0] = {}, offline = false): ClockView {
  return { kind: "ready", state: attendance(overrides), offline, readAt: READ_AT };
}

async function renderBody(
  view: ClockView,
  {
    busy = null,
    notice = null,
    showAttendanceLink = true,
    location,
    locationNotice,
  }: {
    busy?: ClockAction | null;
    notice?: WriteNotice | null;
    showAttendanceLink?: boolean;
    location?: LocationStatus;
    locationNotice?: { saving: boolean; failed: boolean; onDismiss: () => void };
  } = {}
) {
  const handlers = {
    onAct: jest.fn(),
    onReread: jest.fn(),
    onNavigate: jest.fn(),
  };
  const rendered = await render(
    <TranslationProvider>
      <ClockBody
        view={view}
        now={NOW}
        busy={busy}
        notice={notice}
        showAttendanceLink={showAttendanceLink}
        location={location}
        locationNotice={locationNotice}
        {...handlers}
      />
    </TranslationProvider>
  );
  return { rendered, ...handlers };
}

const disabled = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState?.disabled === true;

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

describe("ClockBody", () => {
  it("shows a skeleton while nothing is cached yet", async () => {
    await renderBody({ kind: "loading" });
    expect(screen.getByTestId("clock-skeleton")).toBeTruthy();
  });

  it("says there is nothing to clock without an Employment", async () => {
    await renderBody({ kind: "no-employment" });
    expect(screen.getByText("You have no attendance to clock here.")).toBeTruthy();
  });

  it("shows only the offline notice on a cold start offline, with Try again", async () => {
    const { onReread } = await renderBody({ kind: "unreachable" });

    expect(screen.getByText("Your clock loads once you're back online.")).toBeTruthy();
    expect(screen.queryByTestId("clock-in")).toBeNull();
    await fireEvent.press(screen.getByText("Try again"));
    expect(onReread).toHaveBeenCalled();
  });

  it("offers Clock in when out, with the day totals and the My attendance row", async () => {
    const { onAct, onNavigate } = await renderBody(ready());

    expect(screen.getByText("Not clocked in")).toBeTruthy();
    expect(screen.getByText("Nothing recorded yet")).toBeTruthy();
    expect(screen.getByText("Presence")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("clock-in"));
    expect(onAct).toHaveBeenCalledWith("clock-in");
    await fireEvent.press(screen.getByText("View my attendance"));
    expect(onNavigate).toHaveBeenCalledWith("/my-attendance");
  });

  it("leaves the My attendance row out when My attendance hosts the widget", async () => {
    await renderBody(ready(), { showAttendanceLink: false });
    expect(screen.queryByText("View my attendance")).toBeNull();
  });

  it("shows the running timer and since HH:MM while clocked in, with break and clock out", async () => {
    const open = session({ startedAt: "2026-09-27T06:00:00.000Z" });
    await renderBody(ready({ openSession: open, sessions: [open] }));

    expect(screen.getByText("Clocked in")).toBeTruthy();
    expect(screen.getByTestId("clock-timer")).toHaveTextContent("1:47:12");
    expect(screen.getByText("since 08:00")).toBeTruthy();
    expect(screen.getByTestId("break-start")).toBeTruthy();
    expect(screen.getByTestId("clock-out")).toBeTruthy();
  });

  it("shows the break's timer with End break and Clock out on a break", async () => {
    const openBreak = pause({ startedAt: "2026-09-27T07:40:00.000Z" });
    const open = session({ breaks: [openBreak] });
    await renderBody(ready({ openSession: open, openBreak, sessions: [open] }));

    expect(screen.getByTestId("clock-status")).toHaveTextContent("On break");
    expect(screen.getByTestId("clock-timer")).toHaveTextContent("7:12");
    expect(screen.getByText("break since 09:40")).toBeTruthy();
    expect(screen.getByTestId("break-end")).toBeTruthy();
  });

  it("spins the pressed action and disables the others until the re-read lands", async () => {
    const open = session();
    await renderBody(ready({ openSession: open, sessions: [open] }), { busy: "break-start" });

    expect(screen.getByText("Starting…")).toBeTruthy();
    expect(disabled("break-start")).toBe(true);
    expect(disabled("clock-out")).toBe(true);
  });

  it("shows the lock notice and no actions when attendance is inactive", async () => {
    await renderBody(ready({ active: false }));

    expect(screen.getByText("Clocking in is off")).toBeTruthy();
    expect(screen.queryByTestId("clock-in")).toBeNull();
    expect(screen.queryByTestId("clock-out")).toBeNull();
  });

  it("keeps Clock out inside the lock notice while a session is still open", async () => {
    const { onAct } = await renderBody(ready({ active: false, openSession: session() }));

    await fireEvent.press(screen.getByTestId("clock-out"));
    expect(onAct).toHaveBeenCalledWith("clock-out");
  });

  it("says the Employment has ended rather than that attendance is off", async () => {
    await renderBody(ready({ employmentEnded: true }));
    expect(screen.getByText("Your employment here has ended")).toBeTruthy();
  });

  it("links the auto-closed notice to that day on My attendance", async () => {
    const swept = session({
      businessDate: "2026-09-24",
      startedAt: "2026-09-24T05:58:00.000Z",
      endedAt: "2026-09-24T21:58:00.000Z",
      closedBy: "SWEEP",
      open: false,
    });
    const { onNavigate } = await renderBody(ready({ autoClosedSession: swept }));

    expect(screen.getByText("Thursday was closed for you")).toBeTruthy();
    await fireEvent.press(screen.getByText("Set the time"));
    expect(onNavigate).toHaveBeenCalledWith("/my-attendance?date=2026-09-24");
  });

  it("keeps the last read offline, says when it was read, and disables the actions", async () => {
    const { onReread } = await renderBody(ready({}, true));

    expect(screen.getByText(/Showing what the phone knew at \d\d:41/)).toBeTruthy();
    expect(disabled("clock-in")).toBe(true);
    await fireEvent.press(screen.getByText("Try again"));
    expect(onReread).toHaveBeenCalled();
  });

  it("shows a network failure as a danger notice whose Retry repeats the write", async () => {
    const { onAct } = await renderBody(ready(), {
      notice: { kind: "network", retry: "clock-in" },
    });

    expect(screen.getByText("Check your signal and try again.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Retry"));
    expect(onAct).toHaveBeenCalledWith("clock-in");
  });

  it("shows a refusal with the server's message and no Retry", async () => {
    await renderBody(ready(), { notice: { kind: "refusal", message: "No break is running" } });

    expect(screen.getByText("No break is running")).toBeTruthy();
    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("drops a refusal the lock notice already explains", async () => {
    await renderBody(ready({ active: false }), {
      notice: { kind: "refusal", message: "Attendance is not active" },
    });

    expect(screen.queryByText("Attendance is not active")).toBeNull();
    expect(screen.getByText("Clocking in is off")).toBeTruthy();
  });

  it("shows Clocked in since HH:MM after a clock-in lost to a session opened elsewhere", async () => {
    const open = session({ startedAt: "2026-09-27T07:09:00.000Z" });
    await renderBody(ready({ openSession: open, sessions: [open] }), {
      notice: { kind: "already-open", message: "A session is already open" },
    });

    expect(screen.getByText("Clocked in since 09:09")).toBeTruthy();
    expect(screen.getByTestId("clock-out")).toBeTruthy();
  });

  it("shows a server fault as its own notice, not as a lost connection", async () => {
    const { onAct } = await renderBody(ready(), { notice: { kind: "server", retry: "clock-out" } });

    expect(screen.getByText("The server had a problem")).toBeTruthy();
    expect(screen.queryByText("Can't reach the server")).toBeNull();
    await fireEvent.press(screen.getByText("Retry"));
    expect(onAct).toHaveBeenCalledWith("clock-out");
  });

  it("reads again, rather than writing again, when only the re-read failed", async () => {
    const { onAct, onReread } = await renderBody(ready(), {
      notice: { kind: "server", retry: "reread" },
    });

    await fireEvent.press(screen.getByText("Retry"));
    expect(onReread).toHaveBeenCalled();
    expect(onAct).not.toHaveBeenCalled();
  });

  it("disables every action offline, Retry included, and leaves Try again live", async () => {
    const open = session();
    await renderBody(ready({ openSession: open, sessions: [open] }, true), {
      notice: { kind: "server", retry: "clock-out" },
    });

    expect(disabled("break-start")).toBe(true);
    expect(disabled("clock-out")).toBe(true);
    expect(disabled("clock-retry")).toBe(true);
    expect(disabled("clock-try-again")).toBe(false);
  });

  it("keeps the actions live when the last re-read only met a server fault", async () => {
    await renderBody(ready({}, false));
    expect(disabled("clock-in")).toBe(false);
    expect(screen.queryByTestId("clock-offline")).toBeNull();
  });

  it("says the server had a problem when the first read faulted, with Try again", async () => {
    const { onReread } = await renderBody({ kind: "read-failed" });

    expect(screen.getByText("The server had a problem")).toBeTruthy();
    expect(screen.queryByText("Can't reach the server")).toBeNull();
    await fireEvent.press(screen.getByText("Try again"));
    expect(onReread).toHaveBeenCalled();
  });

  it("shows the location notice above the clock, with Got it and the privacy policy", async () => {
    const onDismiss = jest.fn();
    await renderBody(ready({ locationEnabled: true }), {
      locationNotice: { saving: false, failed: false, onDismiss },
    });

    expect(screen.getByText("Your organization records where you clock")).toBeTruthy();
    expect(screen.queryByTestId("clock-location-save-failed")).toBeNull();
    await fireEvent.press(screen.getByText("Got it"));
    expect(onDismiss).toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Privacy policy"));
    expect(openWebPage).toHaveBeenCalledWith("/privacy/");
  });

  it("keeps the notice with a short line and Got it live when the save failed", async () => {
    await renderBody(ready({ locationEnabled: true }), {
      locationNotice: { saving: false, failed: true, onDismiss: jest.fn() },
    });
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
    expect(disabled("clock-location-got-it")).toBe(false);
  });

  it("holds Got it while the save is in flight", async () => {
    await renderBody(ready({ locationEnabled: true }), {
      locationNotice: { saving: true, failed: false, onDismiss: jest.fn() },
    });
    expect(disabled("clock-location-got-it")).toBe(true);
  });

  it("leaves the location notice out unless it is asked for", async () => {
    await renderBody(ready({ locationEnabled: true }));
    expect(screen.queryByTestId("clock-location-notice")).toBeNull();
    expect(screen.queryByTestId("clock-location")).toBeNull();
  });

  it.each<[LocationStatus, string]>([
    [{ kind: "finding" }, "Finding your location…"],
    [{ kind: "sharpening", accuracy: 65 }, "Location saved (±65\u00a0m), sharpening…"],
    [{ kind: "saved", end: "IN", accuracy: 6 }, "Clock-in location saved (±6\u00a0m)"],
    [{ kind: "saved", end: "OUT", accuracy: 1_540 }, "Clock-out location saved (±1.5\u00a0km)"],
    [{ kind: "approximate" }, "Approximate location saved"],
  ])("shows the location line for %j", async (location, copy) => {
    await renderBody(ready({ locationEnabled: true }), { location });
    expect(screen.getByText(copy)).toBeTruthy();
  });
});
