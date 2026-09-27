export function dateOfTime(time: string, day: Date = new Date()): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(day);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export function timeOfDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
