import { round } from "./round";

export function niceScale(max: number, targetTicks = 3): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 2, 4] };
  const raw = max / targetTicks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? power * 10);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + 1e-9; value += step) ticks.push(round(value));
  return { top, ticks };
}

export type Band = { x: number; width: number; slotX: number; slotWidth: number };

export function bands(count: number, width: number, gapRatio = 0.34): Band[] {
  const slot = width / Math.max(1, count);
  const bar = slot * (1 - gapRatio);
  return Array.from({ length: count }, (_, index) => ({
    x: index * slot + (slot - bar) / 2,
    width: bar,
    slotX: index * slot,
    slotWidth: slot,
  }));
}

export type CalloutSpan = { left: number; width: number };

/**
 * Beside the column, on its preferred side unless that side is too narrow, and never over it. The
 * callout shrinks towards `min` before it flips.
 */
export function calloutSpan(
  band: Band,
  preferRight: boolean,
  chartWidth: number,
  offset: number,
  size: { ideal: number; min: number; gap: number }
): CalloutSpan {
  const rightStart = offset + band.slotX + band.slotWidth + size.gap;
  const rightRoom = Math.max(0, chartWidth - rightStart);
  const leftRoom = Math.max(0, offset + band.slotX - size.gap);
  const right = { left: rightStart, width: Math.min(size.ideal, rightRoom) };
  const leftWidth = Math.min(size.ideal, leftRoom);
  const left = { left: leftRoom - leftWidth, width: leftWidth };
  if (preferRight) return rightRoom >= size.min || rightRoom >= leftRoom ? right : left;
  return leftRoom >= size.min || leftRoom >= rightRoom ? left : right;
}

export function roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    "Z",
  ].join(" ");
}

/** A bar square on the left and rounded on the right, for the end segment of a horizontal bar. */
export function roundedRightRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, h / 2, w));
  return [
    `M${x},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h - rr}`,
    `Q${x + w},${y + h} ${x + w - rr},${y + h}`,
    `L${x},${y + h}`,
    "Z",
  ].join(" ");
}
