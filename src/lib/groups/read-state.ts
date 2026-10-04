export type Read<T = unknown> = { data: T | undefined; isError: boolean; dataUpdatedAt: number };

export type TabReadState =
  { kind: "loading" } | { kind: "failed" } | { kind: "ready"; staleSince: number | null };

export function tabReadState(reads: readonly Read[]): TabReadState {
  if (reads.some((read) => read.data === undefined && read.isError)) return { kind: "failed" };
  if (reads.some((read) => read.data === undefined)) return { kind: "loading" };
  const stale = reads.filter((read) => read.isError).map((read) => read.dataUpdatedAt);
  return { kind: "ready", staleSince: stale.length > 0 ? Math.min(...stale) : null };
}
