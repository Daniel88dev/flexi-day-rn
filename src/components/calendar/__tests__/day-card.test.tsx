import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { DayCard } from "@/components/calendar/day-card";
import { LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { TranslationProvider } from "@/i18n/use-translation";
import { applyPage } from "@/lib/local-store/apply";
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

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore("me");
  await act(async () => {
    store.write((transaction) =>
      applyPage(
        transaction,
        syncPage({
          users: [userRow({ id: "me", name: "Dana Holt" })],
          groups: [groupRow({ id: "g-1", holidayCountry: "CZ" })],
          groupUsers: [groupUserRow({ groupId: "g-1", userId: "me" })],
          bankHolidays: [bankHolidayRow({ date: "2026-10-28", name: "Statehood" })],
          vacations: [
            vacationRow({ id: "v-1", userId: "me", groupId: "g-1", requestedDay: "2026-10-28" }),
          ],
        }),
        1
      )
    );
  });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

async function renderCard(filter = new Set(LEAVE_TYPE_ORDER)) {
  const onBook = jest.fn();
  await render(
    <TranslationProvider>
      <DayCard
        day="2026-10-28"
        scope={{ kind: "mine" }}
        filter={filter}
        viewerId="me"
        onBook={onBook}
      />
    </TranslationProvider>
  );
  return onBook;
}

describe("DayCard", () => {
  it("renders the shared day list inline, with the day's holidays and people", async () => {
    await renderCard();

    expect(await screen.findByText("Statehood")).toBeOnTheScreen();
    expect(screen.getByTestId("day-card")).toBeOnTheScreen();
    expect(screen.getByTestId("day-list")).toHaveTextContent(/Wed 28 Oct/);
    expect(screen.getByTestId("day-list-row-v-1")).toHaveTextContent(/You/);
  });

  it("leaves out a type the filter hides", async () => {
    await renderCard(new Set(["HOME_OFFICE"]));

    expect(await screen.findByTestId("day-list")).toHaveTextContent(/Nobody is away/);
    expect(screen.queryByTestId("day-list-row-v-1")).toBeNull();
    expect(screen.queryByText("Statehood")).toBeNull();
  });

  it("books the day it shows", async () => {
    const onBook = await renderCard();

    await fireEvent.press(await screen.findByTestId("day-list-book"));

    expect(onBook).toHaveBeenCalledWith("2026-10-28");
  });
});
