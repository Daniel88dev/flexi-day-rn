import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { MonthPager } from "@/components/calendar/month-pager";

const MONTHS = [
  { year: 2026, month: 9 },
  { year: 2026, month: 10 },
  { year: 2026, month: 11 },
];

describe("MonthPager", () => {
  it("renders the month at its index", async () => {
    await render(
      <MonthPager
        months={MONTHS}
        index={1}
        onIndex={jest.fn()}
        width={390}
        height={400}
        extraData={null}
        renderMonth={(month) => <Text>{`page ${month.year}-${month.month}`}</Text>}
      />
    );

    expect(screen.getByTestId("calendar-pager")).toBeOnTheScreen();
    expect(screen.getByText("page 2026-10")).toBeOnTheScreen();
  });
});
