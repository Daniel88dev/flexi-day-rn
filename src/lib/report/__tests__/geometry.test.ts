import { bands, calloutSpan, niceScale, roundedRightRect, roundedTopRect } from "../geometry";

describe("niceScale", () => {
  it("returns integer steps of 1, 2 or 5 times a power of ten", () => {
    expect(niceScale(21)).toEqual({ top: 30, ticks: [0, 10, 20, 30] });
    expect(niceScale(10)).toEqual({ top: 10, ticks: [0, 5, 10] });
    expect(niceScale(4)).toEqual({ top: 4, ticks: [0, 2, 4] });
    expect(niceScale(140)).toEqual({ top: 150, ticks: [0, 50, 100, 150] });
  });

  it("returns whole-day steps for a window of half days", () => {
    expect(niceScale(0.5)).toEqual({ top: 1, ticks: [0, 1] });
    expect(niceScale(1)).toEqual({ top: 1, ticks: [0, 1] });
  });

  it("returns a default axis for an empty window", () => {
    expect(niceScale(0)).toEqual({ top: 4, ticks: [0, 2, 4] });
  });
});

describe("bands", () => {
  it("returns equal slots across the width with each bar centred in its slot", () => {
    const [first, second] = bands(4, 200, 0.5);
    expect(first).toEqual({ x: 12.5, width: 25, slotX: 0, slotWidth: 50 });
    expect(second).toEqual({ x: 62.5, width: 25, slotX: 50, slotWidth: 50 });
    expect(bands(12, 300)).toHaveLength(12);
  });

  it("returns nothing for no columns", () => {
    expect(bands(0, 300)).toEqual([]);
  });
});

describe("calloutSpan", () => {
  const size = { ideal: 184, min: 140, gap: 4 };
  const chartWidth = 329;
  const cols = bands(12, chartWidth - 24);

  it("returns a span beside every column at phone width, inside the chart and never over the column", () => {
    cols.forEach((band, index) => {
      const span = calloutSpan(band, index < 6, chartWidth, 24, size);
      const columnLeft = 24 + band.slotX;
      const columnRight = columnLeft + band.slotWidth;
      const clear = span.left + span.width <= columnLeft || span.left >= columnRight;
      expect({ index, clear }).toEqual({ index, clear: true });
      expect(span.left).toBeGreaterThanOrEqual(0);
      expect(span.left + span.width).toBeLessThanOrEqual(chartWidth + 1e-9);
      expect(span.width).toBeGreaterThanOrEqual(size.min);
    });
  });

  it("returns the right side in the first half and the left side in the second when both fit", () => {
    const wide = bands(12, 600);
    const first = calloutSpan(wide[1], true, 624, 24, size);
    const last = calloutSpan(wide[10], false, 624, 24, size);
    expect(first).toEqual({ left: 24 + 100 + 4, width: 184 });
    expect(last).toEqual({ left: 24 + 500 - 4 - 184, width: 184 });
  });

  it("returns the other side when the preferred one is too narrow", () => {
    const span = calloutSpan(cols[1], false, chartWidth, 24, size);
    expect(span.left).toBeCloseTo(24 + cols[1].slotX + cols[1].slotWidth + 4);
    expect(span.width).toBe(184);
  });

  it("returns a callout narrowed to the room beside a middle column", () => {
    const span = calloutSpan(cols[5], true, chartWidth, 24, size);
    expect(span.left).toBeCloseTo(24 + cols[5].slotX + cols[5].slotWidth + 4);
    expect(span.width).toBeCloseTo(chartWidth - span.left);
  });
});

describe("roundedTopRect", () => {
  it("returns a path rounded on its top corners and square at the bottom", () => {
    expect(roundedTopRect(0, 10, 20, 30, 4)).toBe(
      "M0,40 L0,14 Q0,10 4,10 L16,10 Q20,10 20,14 L20,40 Z"
    );
  });

  it("returns a radius no larger than half the width or the whole height", () => {
    expect(roundedTopRect(0, 0, 6, 2, 4)).toBe("M0,2 L0,2 Q0,0 2,0 L4,0 Q6,0 6,2 L6,2 Z");
  });
});

describe("roundedRightRect", () => {
  it("returns a path square on the left and rounded on the right", () => {
    expect(roundedRightRect(10, 0, 40, 6, 3)).toBe(
      "M10,0 L47,0 Q50,0 50,3 L50,3 Q50,6 47,6 L10,6 Z"
    );
  });

  it("returns a radius no larger than half the height or the whole width", () => {
    expect(roundedRightRect(0, 0, 2, 6, 3)).toBe("M0,0 L0,0 Q2,0 2,2 L2,4 Q2,6 0,6 L0,6 Z");
  });
});
