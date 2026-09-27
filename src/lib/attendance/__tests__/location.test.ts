import { session } from "@/test-support/attendance";

import { anySessionLocated, locationText } from "../location";

const located = session({ startLatitude: 50.08754, startLongitude: 14.42132, startAccuracy: 11.6 });

describe("anySessionLocated", () => {
  it("returns true once either end of any session has coordinates", () => {
    expect(anySessionLocated([session(), located])).toBe(true);
    expect(anySessionLocated([session({ endLatitude: 50, endLongitude: 14 })])).toBe(true);
  });

  it("returns false when no session has a fix", () => {
    expect(anySessionLocated([session(), session()])).toBe(false);
    expect(anySessionLocated([])).toBe(false);
  });
});

describe("locationText", () => {
  it("returns coordinates to four places with the accuracy in whole metres", () => {
    expect(locationText(located, "IN")).toEqual({ coordinates: "50.0875, 14.4213", accuracy: 12 });
  });

  it("returns null coordinates for an end without a fix", () => {
    expect(locationText(located, "OUT")).toEqual({ coordinates: null, accuracy: null });
  });

  it("returns no accuracy when the fix carries none worth showing", () => {
    const vague = session({ endLatitude: 50, endLongitude: 14, endAccuracy: 0 });
    expect(locationText(vague, "OUT")).toEqual({ coordinates: "50.0000, 14.0000", accuracy: null });
  });
});
