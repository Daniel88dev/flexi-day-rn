import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

describe("requests.windowLength", () => {
  it("returns each length with its plural", () => {
    expect([1, 3, 6].map(en.requests.windowLength)).toEqual(["1 month", "3 months", "6 months"]);
    expect([1, 3, 6].map(cs.requests.windowLength)).toEqual(["1 měsíc", "3 měsíce", "6 měsíců"]);
  });
});

describe("requests.empty", () => {
  it("returns the empty state naming the window", () => {
    expect(en.requests.empty("Oct – Dec 2026")).toBe("No requests in Oct – Dec 2026");
    expect(cs.requests.empty("Říj – Pro 2026")).toBe("Žádné žádosti v období Říj – Pro 2026");
  });
});

describe("requests.emptyFiltered", () => {
  it("returns the filtered empty state naming the filter and the window", () => {
    expect(en.requests.emptyFiltered("pending", "Oct – Dec 2026")).toBe(
      "No pending requests in Oct – Dec 2026"
    );
    expect(en.requests.emptyFiltered("mine", "Oct 2026")).toBe("You have no requests in Oct 2026");
    expect(cs.requests.emptyFiltered("pending", "Říj – Pro 2026")).toBe(
      "Žádné čekající žádosti v období Říj – Pro 2026"
    );
  });
});
