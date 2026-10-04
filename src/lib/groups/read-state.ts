export type Read<T = unknown> = { data: T | undefined; isError: boolean; dataUpdatedAt: number };

export type TabReadState =
  { kind: "loading" } | { kind: "failed" } | { kind: "ready"; staleSince: number | null };

export function tabReadState(reads: readonly Read[]): TabReadState {
  if (reads.some((read) => read.data === undefined && read.isError)) return { kind: "failed" };
  if (reads.some((read) => read.data === undefined)) return { kind: "loading" };
  const stale = reads.filter((read) => read.isError).map((read) => read.dataUpdatedAt);
  return { kind: "ready", staleSince: stale.length > 0 ? Math.min(...stale) : null };
}

/** Nothing until the read first answers with rows; after that the rows, stale once a refetch fails. */
export function shownList<T>(
  read: Read<readonly T[]>
): { items: readonly T[]; staleSince: number | null } | null {
  if (!read.data || read.data.length === 0) return null;
  return { items: read.data, staleSince: read.isError ? read.dataUpdatedAt : null };
}

// A plain copy read during this render: TanStack re-renders only for the fields a render touched.
export const snapshot = <T>({ data, isError, dataUpdatedAt }: Read<T>): Read<T> => ({
  data,
  isError,
  dataUpdatedAt,
});
