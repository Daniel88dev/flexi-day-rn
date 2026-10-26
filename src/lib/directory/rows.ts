import type { DirectoryMarker, DirectoryPerson, FormerDirectoryPerson } from "./types";

export type RowMarker = DirectoryMarker | "RETENTION_HOLD" | "YOU";

const ORDER: RowMarker[] = [
  "RETENTION_HOLD",
  "EXTERNAL_WORKER",
  "NO_ACCOUNT",
  "INVITE_SENT",
  "ACCOUNT_DELETED",
  "REJOINED",
  "YOU",
];

/**
 * The badges a row carries. The server already left out the ones the viewer may not see; the
 * phone adds You on the viewer's own row and the hold the Former list sends.
 */
export function rowMarkers(
  person: DirectoryPerson & Pick<Partial<FormerDirectoryPerson>, "hold">,
  viewerUserId: string | null
): RowMarker[] {
  const shown = new Set<RowMarker>(person.markers);
  if (person.hold) shown.add("RETENTION_HOLD");
  if (viewerUserId !== null && person.user.id === viewerUserId) shown.add("YOU");
  return ORDER.filter((marker) => shown.has(marker));
}

export function formerNewestFirst(rows: readonly FormerDirectoryPerson[]): FormerDirectoryPerson[] {
  return [...rows].sort((a, b) => b.endedAt.localeCompare(a.endedAt));
}
