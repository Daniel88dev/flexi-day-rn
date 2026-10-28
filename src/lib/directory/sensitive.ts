import type { HomeAddress, ProfileRef, SensitiveSectionKey } from "./types";

/** The only route that carries Contact or Personal values; each call by someone else is logged. */
export const showSectionPath = (
  { organizationId, employmentId }: ProfileRef,
  section: SensitiveSectionKey,
  language: string
) =>
  `/api/directory/${encodeURIComponent(organizationId)}/people/${encodeURIComponent(employmentId)}/show/${section}?language=${language}`;

export function addressLines(address: HomeAddress): string[] {
  return [
    address.line1,
    address.line2,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.region,
    address.country.name,
  ].filter((line): line is string => Boolean(line));
}
