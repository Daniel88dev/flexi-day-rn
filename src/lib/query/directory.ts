import { useQuery } from "@tanstack/react-query";

import type {
  DirectoryOrganization,
  DirectoryPeople,
  FormerDirectoryPerson,
} from "@/lib/directory";

import { qk } from "./keys";
import { useRereadOnFocus } from "./reread-on-focus";
import { apiRequest } from "./runtime";

/**
 * The directory is read live and never kept: no Local store table, and the people drop out of
 * the memory cache once no screen shows them (`gcTime` 0).
 */
const NOT_KEPT = { gcTime: 0 } as const;

/** The shell's People section and the directory's organization picker both read this. */
export function useDirectoryOrganizations(enabled = true) {
  return useQuery({
    queryKey: qk.directoryOrganizations(),
    queryFn: ({ signal }) =>
      apiRequest<DirectoryOrganization[]>("/api/directory/organizations", { signal }),
    enabled,
  });
}

export function useDirectoryPeople(organizationId: string | null) {
  return useQuery({
    queryKey: qk.directoryPeople(organizationId ?? ""),
    queryFn: ({ signal }) =>
      apiRequest<DirectoryPeople>(
        `/api/directory/${encodeURIComponent(organizationId ?? "")}/people`,
        { signal }
      ),
    enabled: organizationId !== null,
    ...NOT_KEPT,
  });
}

export function useFormerDirectoryPeople(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.directoryFormer(organizationId ?? ""),
    queryFn: ({ signal }) =>
      apiRequest<FormerDirectoryPerson[]>(
        `/api/directory/${encodeURIComponent(organizationId ?? "")}/former`,
        { signal }
      ),
    enabled: enabled && organizationId !== null,
    ...NOT_KEPT,
  });
}

const DIRECTORY_READS = [["directory"]] as const;

export function useRereadDirectoryOnFocus(): void {
  useRereadOnFocus(DIRECTORY_READS);
}
