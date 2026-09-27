import { render, screen } from "@testing-library/react-native";

import { SessionGroup } from "@/components/attendance/session-group";
import { TranslationProvider } from "@/i18n/use-translation";
import type { AttendanceSession } from "@/lib/attendance";
import { pause, session } from "@/test-support/attendance";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

const TODAY = "2026-09-27";
const NOW = Date.parse("2026-09-27T10:00:00Z");

const closed = (overrides: Partial<AttendanceSession> = {}) =>
  session({
    businessDate: "2026-09-24",
    startedAt: "2026-09-24T06:00:00.000Z",
    endedAt: "2026-09-24T10:00:00.000Z",
    closedBy: "USER",
    open: false,
    ...overrides,
  });

async function renderGroup(entry: AttendanceSession, showLocation = false) {
  await render(
    <TranslationProvider>
      <SessionGroup session={entry} today={TODAY} now={NOW} showLocation={showLocation} />
    </TranslationProvider>
  );
}

describe("SessionGroup marks", () => {
  it("shows no marks and no notice for a session clocked and closed by its owner", async () => {
    await renderGroup(closed());

    expect(screen.queryByTestId(/^mark-/)).toBeNull();
    expect(screen.queryByTestId("changed-notice")).toBeNull();
    expect(screen.getByText("08:00 - 12:00")).toBeTruthy();
  });

  it("stamps an entered session", async () => {
    await renderGroup(closed({ origin: "ENTERED" }));

    expect(screen.getByTestId("mark-entered")).toBeTruthy();
    expect(screen.getByText("Entered")).toBeTruthy();
  });

  it("flags a session changed after the day, with the blue notice under it", async () => {
    await renderGroup(closed({ changedAfterDay: true }));

    expect(screen.getByText("Changed after the day")).toBeTruthy();
    expect(screen.getByTestId("changed-notice")).toBeTruthy();
    expect(screen.getByText(/You changed this session after its day/)).toBeTruthy();
  });

  it("flags a session the sweep closed above the session", async () => {
    await renderGroup(closed({ closedBy: "SWEEP" }));

    expect(screen.getByTestId("mark-auto-closed")).toBeTruthy();
    expect(screen.queryByTestId("row-auto-closed")).toBeNull();
  });

  it("flags a break the sweep closed on its own row, not above the session", async () => {
    await renderGroup(
      closed({
        breaks: [
          pause({
            startedAt: "2026-09-24T08:00:00.000Z",
            endedAt: "2026-09-24T10:00:00.000Z",
            autoClosed: true,
            open: false,
          }),
        ],
      })
    );

    expect(screen.queryByTestId("mark-auto-closed")).toBeNull();
    expect(screen.getByTestId("row-auto-closed")).toBeTruthy();
  });

  it("marks a session still open today, its last row running to now", async () => {
    await renderGroup(session({ businessDate: TODAY, startedAt: "2026-09-27T06:00:00.000Z" }));

    expect(screen.getByText("Still open")).toBeTruthy();
    expect(screen.getByText("08:00 - now")).toBeTruthy();
    expect(screen.getByText("4:00")).toBeTruthy();
  });
});

describe("SessionGroup on a day that has passed", () => {
  it("reads a session left open as still open rather than running to now", async () => {
    await renderGroup(
      session({ businessDate: "2026-09-26", startedAt: "2026-09-26T06:00:00.000Z" })
    );

    expect(screen.getByText("08:00 - Still open")).toBeTruthy();
    expect(screen.queryByText(/- now$/)).toBeNull();
  });
});

describe("SessionGroup location", () => {
  it("leaves the strip out when the Day view does not ask for it", async () => {
    await renderGroup(closed({ startLatitude: 50.08754, startLongitude: 14.42132 }));

    expect(screen.queryByTestId("session-location")).toBeNull();
  });

  it("shows both ends as coordinates with their accuracy", async () => {
    await renderGroup(
      closed({
        startLatitude: 50.08754,
        startLongitude: 14.42132,
        startAccuracy: 11.6,
        endLatitude: 50.0901,
        endLongitude: 14.4003,
        endAccuracy: 38,
      }),
      true
    );

    expect(screen.getByText("Clocked in at")).toBeTruthy();
    expect(screen.getByTestId("location-in").props.children).toBe("50.0875, 14.4213 ±12 m");
    expect(screen.getByTestId("location-out").props.children).toBe("50.0901, 14.4003 ±38 m");
  });

  it("shows a dash for an end without a fix", async () => {
    await renderGroup(closed({ startLatitude: 50.08754, startLongitude: 14.42132 }), true);

    expect(screen.getByTestId("location-in").props.children).toBe("50.0875, 14.4213");
    expect(screen.getByTestId("location-out").props.children).toBe("—");
  });
});
