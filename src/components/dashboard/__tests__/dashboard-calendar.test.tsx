import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ActionSheetIOS } from "react-native";

import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import { TranslationProvider } from "@/i18n/use-translation";
import { applyPage } from "@/lib/local-store/apply";
import type { SyncEnvelope } from "@/lib/local-store/envelope";
import type { StoreRuntime } from "@/lib/local-store/runtime";
import {
  bankHolidayRow,
  groupRow,
  groupUserRow,
  syncPage,
  userRow,
  vacationRow,
} from "@/lib/local-store/test-support/sync-fixtures";
import { openTestStore } from "@/lib/local-store/test-support/test-store";
import { useMySettings, type MySettings } from "@/lib/query";

jest.mock("@/lib/query", () => ({ useMySettings: jest.fn() }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));

const VIEWER = "me";
const APPROVED = "2026-10-01T08:00:00.000Z";

const settingsQuery = useMySettings as jest.MockedFunction<typeof useMySettings>;

let choose: (index: number) => void = () => {};
const showSheet = jest
  .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
  .mockImplementation((_options, callback) => {
    choose = callback;
  });

let store: StoreRuntime;

function answerSettings(settings: Partial<MySettings> | undefined) {
  settingsQuery.mockReturnValue({ data: settings } as ReturnType<typeof useMySettings>);
}

async function pullIn(page: Partial<SyncEnvelope>) {
  await act(async () => {
    store.write((transaction) => applyPage(transaction, syncPage(page), 1));
  });
}

beforeEach(async () => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 14, 10),
    doNotFake: ["setImmediate", "nextTick", "queueMicrotask"],
  });
  showSheet.mockClear();
  answerSettings(undefined);
  store = await openTestStore(VIEWER);
  await pullIn({
    users: [
      userRow({ id: VIEWER, name: "Dana Holt" }),
      userRow({ id: "eva", name: "Eva Novak" }),
      userRow({ id: "tom", name: "Tom Berg" }),
    ],
    groups: [
      groupRow({ id: "g-design", groupName: "Design", holidayCountry: "CZ" }),
      groupRow({ id: "g-platform", groupName: "Platform", holidayCountry: null }),
    ],
    groupUsers: [
      groupUserRow({ id: "gu-1", groupId: "g-design", userId: VIEWER, viewAccess: true }),
      groupUserRow({ id: "gu-2", groupId: "g-platform", userId: VIEWER, viewAccess: true }),
      groupUserRow({ id: "gu-3", groupId: "g-design", userId: "eva" }),
      groupUserRow({ id: "gu-4", groupId: "g-platform", userId: "tom" }),
    ],
    bankHolidays: [bankHolidayRow({ id: "h", date: "2026-10-28", name: "Statehood" })],
    vacations: [
      vacationRow({
        id: "mine-14",
        userId: VIEWER,
        groupId: "g-design",
        requestId: "r-mine",
        requestedDay: "2026-10-14",
        approvedAt: APPROVED,
      }),
      vacationRow({
        id: "eva-14",
        userId: "eva",
        groupId: "g-design",
        requestId: "r-eva",
        requestedDay: "2026-10-14",
        vacationType: "HOME_OFFICE",
      }),
      vacationRow({
        id: "tom-15",
        userId: "tom",
        groupId: "g-platform",
        requestId: "r-tom",
        requestedDay: "2026-10-15",
        approvedAt: APPROVED,
      }),
    ],
  });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
  jest.useRealTimers();
});

async function renderCalendar({ withOpen = true } = {}) {
  const handlers = { onOpenRequest: jest.fn(), onBook: jest.fn(), onYear: jest.fn() };
  await render(
    <TranslationProvider>
      <DashboardCalendar
        viewerId={VIEWER}
        onOpenRequest={withOpen ? handlers.onOpenRequest : undefined}
        onBook={handlers.onBook}
        onYear={handlers.onYear}
      />
    </TranslationProvider>
  );
  return handlers;
}

describe("DashboardCalendar", () => {
  it("opens on this month, Mine, while the settings have not answered", async () => {
    await renderCalendar();

    expect(screen.getByTestId("calendar-title")).toHaveTextContent("October 2026");
    expect(screen.getByTestId("calendar-scope-mine")).toBeSelected();
    expect(screen.getByTestId("calendar-bar-mine-14")).toHaveTextContent(/You$/);
    expect(screen.queryByTestId("calendar-bar-eva-14")).toBeNull();
  });

  it("opens on the stored group once the settings answer", async () => {
    answerSettings({ dashboardScope: "GROUP", dashboardGroupId: "g-platform" });

    await renderCalendar();

    expect(screen.getByTestId("calendar-scope-group")).toBeSelected();
    expect(screen.getByTestId("calendar-group-picker")).toHaveTextContent("Platform");
    expect(screen.getByTestId("calendar-bar-tom-15")).toBeOnTheScreen();
    expect(screen.queryByTestId("calendar-bar-mine-14")).toBeNull();
  });

  it("keeps a scope chosen on the dashboard over the stored one, and stores nothing", async () => {
    answerSettings({ dashboardScope: "GROUP", dashboardGroupId: "g-platform" });
    await renderCalendar();

    await fireEvent.press(screen.getByTestId("calendar-group-picker"));
    await act(async () => choose(0));

    expect(screen.getByTestId("calendar-group-picker")).toHaveTextContent("Design");
    expect(screen.getByTestId("calendar-bar-eva-14")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("calendar-scope-mine"));

    expect(screen.getByTestId("calendar-scope-mine")).toBeSelected();
    expect(screen.queryByTestId("calendar-bar-eva-14")).toBeNull();
  });

  it("returns to the group picked this session after Mine and back to Group", async () => {
    answerSettings({ dashboardScope: "GROUP", dashboardGroupId: "g-platform" });
    await renderCalendar();

    await fireEvent.press(screen.getByTestId("calendar-group-picker"));
    await act(async () => choose(0));
    await fireEvent.press(screen.getByTestId("calendar-scope-mine"));
    await fireEvent.press(screen.getByTestId("calendar-scope-group"));

    expect(screen.getByTestId("calendar-group-picker")).toHaveTextContent("Design");
    expect(screen.getByTestId("calendar-bar-eva-14")).toBeOnTheScreen();
  });

  it("moves today on at midnight, so the title jumps to the new month", async () => {
    jest.setSystemTime(new Date(2026, 9, 31, 23, 0));
    await renderCalendar();

    await act(async () => {
      jest.advanceTimersByTime(2 * 60 * 60_000);
    });
    await fireEvent.press(screen.getByTestId("calendar-title"));

    expect(screen.getByTestId("calendar-title")).toHaveTextContent("November 2026");
  });

  it("shows the bank holidays of every country across the viewer's groups for Mine", async () => {
    await renderCalendar();

    expect(screen.getByTestId("calendar-holiday-2026-10-28")).toHaveTextContent("Statehood");
  });

  it("steps months with the arrows and comes back to this one from the title", async () => {
    await renderCalendar();

    await fireEvent.press(screen.getByTestId("calendar-next"));
    expect(screen.getByTestId("calendar-title")).toHaveTextContent("November 2026");

    await fireEvent.press(screen.getByTestId("calendar-title"));
    expect(screen.getByTestId("calendar-title")).toHaveTextContent("October 2026");
  });

  it("reports the year of the month on screen as it changes", async () => {
    const { onYear } = await renderCalendar();
    expect(onYear).toHaveBeenLastCalledWith(2026);

    for (let step = 0; step < 3; step++) await fireEvent.press(screen.getByTestId("calendar-next"));

    expect(onYear).toHaveBeenLastCalledWith(2027);
  });

  it("stops at January of last year", async () => {
    await renderCalendar();

    for (let step = 0; step < 21; step++)
      await fireEvent.press(screen.getByTestId("calendar-previous"));

    expect(screen.getByTestId("calendar-title")).toHaveTextContent("January 2025");
    expect(screen.getByTestId("calendar-previous")).toBeDisabled();
  });

  it("opens the day list with a Book button on a tapped day", async () => {
    answerSettings({ dashboardScope: "GROUP", dashboardGroupId: "g-design" });
    const { onBook } = await renderCalendar();

    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-14"));

    expect(await screen.findByTestId("day-list")).toHaveTextContent(/Wed 14 Oct/);
    expect(screen.getByTestId("day-list")).toHaveTextContent(/2 away or remote/);
    expect(screen.getByTestId("day-list-row-mine-14")).toHaveTextContent(/You/);
    expect(screen.getByTestId("day-list-row-eva-14")).toHaveTextContent(/Pending/);

    await fireEvent.press(screen.getByTestId("day-list-book"));
    expect(onBook).toHaveBeenCalledWith("2026-10-14");
    // The form opens as a sheet of its own, so the day list goes first.
    expect(screen.queryByTestId("day-list")).toBeNull();
  });

  it("closes the day list and opens the request from a tapped row", async () => {
    const { onOpenRequest } = await renderCalendar();

    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-14"));
    await fireEvent.press(await screen.findByTestId("day-list-row-mine-14"));

    expect(onOpenRequest).toHaveBeenCalledWith("mine-14");
    expect(screen.queryByTestId("day-list")).toBeNull();
  });

  it("keeps the day list open on a row tap while there is no request to open", async () => {
    await renderCalendar({ withOpen: false });

    await fireEvent.press(screen.getByTestId("calendar-day-2026-10-14"));
    await fireEvent.press(await screen.findByTestId("day-list-row-mine-14"));

    expect(screen.getByTestId("day-list")).toBeOnTheScreen();
  });

  it("hides a type the filter leaves out, and says how many types it shows", async () => {
    await renderCalendar();

    await fireEvent.press(screen.getByTestId("calendar-filter"));
    await fireEvent.press(await screen.findByTestId("filter-sheet-VACATION"));

    expect(screen.queryByTestId("calendar-bar-mine-14")).toBeNull();
    expect(screen.getByTestId("calendar-filter")).toHaveTextContent("8 types");
  });

  it("renders the legend with its Pending entry", async () => {
    await renderCalendar();

    expect(screen.getByTestId("calendar-legend")).toHaveTextContent(/Vacation/);
    expect(screen.getByTestId("calendar-legend-pending")).toHaveTextContent("Pending");
  });
});
