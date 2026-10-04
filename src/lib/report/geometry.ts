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
