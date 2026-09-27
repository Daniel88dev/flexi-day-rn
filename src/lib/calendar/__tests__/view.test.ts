import { calendarView, storedCalendarView } from "@/lib/calendar/view";

describe("calendarView", () => {
  it("returns stripes when the last answer stored STRIPES", () => {
    expect(calendarView({ dashboardCalendarView: "STRIPES" })).toBe("stripes");
  });

  it("returns lanes when the last answer stored LANES", () => {
    expect(calendarView({ dashboardCalendarView: "LANES" })).toBe("lanes");
  });

  it("returns lanes before the first answer, which is also an offline cold start", () => {
    expect(calendarView(undefined)).toBe("lanes");
  });
});

describe("storedCalendarView", () => {
  it("returns the stored value for each view, the inverse of calendarView", () => {
    expect(storedCalendarView("stripes")).toBe("STRIPES");
    expect(storedCalendarView("lanes")).toBe("LANES");
  });
});
