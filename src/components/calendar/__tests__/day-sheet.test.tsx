import { act, render, screen } from "@testing-library/react-native";

import { DaySheet } from "@/components/calendar/day-sheet";
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

async function renderSheet(day: string | null) {
  await render(
    <TranslationProvider>
      <DaySheet
        day={day}
        onClose={jest.fn()}
        scope={{ kind: "mine" }}
        filter={new Set(LEAVE_TYPE_ORDER)}
        viewerId="me"
        onBook={jest.fn()}
      />
    </TranslationProvider>
  );
}

describe("DaySheet", () => {
  it("renders the day's holidays and people from the Local store", async () => {
    await renderSheet("2026-10-28");

    expect(screen.getByTestId("day-list")).toHaveTextContent(/Wed 28 Oct/);
    expect(screen.getByText("Statehood")).toBeOnTheScreen();
    expect(screen.getByTestId("day-list-row-v-1")).toHaveTextContent(/You/);
  });

  it("renders nothing without a day", async () => {
    await renderSheet(null);

    expect(screen.queryByTestId("day-list")).toBeNull();
  });
});
