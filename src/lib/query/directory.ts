import { useQuery } from "@tanstack/react-query";

import type { Locale } from "@/i18n";
import type {
  DirectoryOrganization,
  DirectoryPeople,
  DirectoryProfile,
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
export function useDirectoryOrganizations() {
  return useQuery({
    queryKey: qk.directoryOrganizations(),
    queryFn: async ({ signal }) => {
      const answer = await apiRequest<unknown>("/api/directory/organizations", { signal });
      // An older backend may answer another shape, which must not take the shell down.
      if (!Array.isArray(answer)) throw new Error("The directory organizations are not a list.");
      return answer as DirectoryOrganization[];
    },
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

/** `language` names the countries and phone regions in the answer, as the web asks. */
export function useDirectoryProfile(
  organizationId: string | null,
  employmentId: string | null,
  language: Locale
) {
  return useQuery({
    queryKey: qk.directoryProfile(organizationId ?? "", employmentId ?? "", language),
    queryFn: ({ signal }) =>
      apiRequest<DirectoryProfile>(
        `/api/directory/${encodeURIComponent(organizationId ?? "")}/people/${encodeURIComponent(employmentId ?? "")}?language=${language}`,
        { signal }
      ),
    enabled: organizationId !== null && employmentId !== null,
    ...NOT_KEPT,
  });
}

const DIRECTORY_READS = [["directory"]] as const;

export function useRereadDirectoryOnFocus(): void {
  useRereadOnFocus(DIRECTORY_READS);
}
