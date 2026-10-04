/** Whole days bare, anything else to one decimal, with the dictionary's decimal separator. */
export function formatDays(value: number, decimalSeparator: string): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return text.replace(".", decimalSeparator);
}
