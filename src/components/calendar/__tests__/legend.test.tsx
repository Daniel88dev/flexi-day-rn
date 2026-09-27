import { render, screen } from "@testing-library/react-native";

import { Legend } from "@/components/calendar/legend";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRange } from "@/lib/calendar/lanes";

const SICK: CalendarRange = {
  id: "r",
  userId: "u",
  userName: "Eva",
  type: "SICK",
  status: "approved",
  halfDay: false,
  from: 1,
  to: 1,
  vacationIds: ["v"],
  names: [],
  pending: false,
};

async function renderLegend(ranges: CalendarRange[]) {
  await render(
    <TranslationProvider>
      <Legend ranges={ranges} />
    </TranslationProvider>
  );
}

describe("Legend", () => {
  it("renders the types the month shows and the Pending mark", async () => {
    await renderLegend([SICK]);

    expect(screen.getByTestId("calendar-legend")).toHaveTextContent(/Sick/);
    expect(screen.getByTestId("calendar-legend")).not.toHaveTextContent(/Vacation/);
    expect(screen.getByTestId("calendar-legend-pending")).toHaveTextContent("Pending");
  });

  it("renders nothing for an empty month", async () => {
    await renderLegend([]);

    expect(screen.queryByTestId("calendar-legend")).toBeNull();
  });
});
