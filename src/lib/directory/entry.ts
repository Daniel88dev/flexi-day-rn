import type { DirectoryOrganization } from "./types";

export type DirectoryEntry = { shown: boolean; readOnly: boolean };

/** The organizations the phone's directory can open: the ones whose directory is on. */
export function directoryOrganizations(
  organizations: readonly DirectoryOrganization[]
): DirectoryOrganization[] {
  return organizations.filter((organization) => organization.enabled);
}

/**
 * The More sheet's Directory row: only for a viewer in a directory organization, with no upsell
 * anywhere else. It reads "read only" once every one of them has lapsed.
 */
export function directoryEntry(organizations: readonly DirectoryOrganization[]): DirectoryEntry {
  const open = directoryOrganizations(organizations);
  if (open.length === 0) return { shown: false, readOnly: false };
  return { shown: true, readOnly: open.every((organization) => !organization.writable) };
}
