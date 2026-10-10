import { render, screen } from "@testing-library/react-native";

import { fadesNumber, MonthSeam, monthShortName } from "@/components/calendar/adjacent-days";
import { dictionaries } from "@/i18n";
import { monthWeeks } from "@/lib/calendar/month-grid";

describe("MonthSeam", () => {
  it("renders a line on the left edge of the day that opens the month mid-week", async () => {
    await render(<MonthSeam week={monthWeeks({ year: 2026, month: 10 })[0]} cellWidth={50} />);

    expect(screen.getByTestId("calendar-seam-2026-10-01")).toHaveStyle({
      left: 149.25,
      width: 1.5,
    });
  });

  it("renders nothing for a week inside the month", async () => {
    await render(<MonthSeam week={monthWeeks({ year: 2026, month: 10 })[2]} cellWidth={50} />);

    expect(screen.queryByTestId(/^calendar-seam-/)).toBeNull();
  });
});

describe("monthShortName", () => {
  it("returns the short name of the date's month in the given language", () => {
    expect(monthShortName(dictionaries.en, "2026-09-28")).toBe("Sep");
    expect(monthShortName(dictionaries.cs, "2026-10-26")).toBe("Říj");
  });
});

describe("fadesNumber", () => {
  it("returns true only for an adjacent day that is not highlighted", () => {
    expect(fadesNumber({ inMonth: false, highlighted: false })).toBe(true);
    expect(fadesNumber({ inMonth: false, highlighted: true })).toBe(false);
    expect(fadesNumber({ inMonth: true, highlighted: false })).toBe(false);
  });
});
