import type { HomeAddress, SensitiveSectionKey } from "./types";

/** The only route that carries Contact or Personal values; each call by someone else is logged. */
export const showSectionPath = (
  organizationId: string,
  employmentId: string,
  section: SensitiveSectionKey,
  language: string
) =>
  `/api/directory/${encodeURIComponent(organizationId)}/people/${encodeURIComponent(employmentId)}/show/${section}?language=${language}`;

/** An address as the lines an envelope carries, empty parts left out. */
export function addressLines(address: HomeAddress): string[] {
  return [
    address.line1,
    address.line2,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.region,
    address.country.name,
  ].filter((line): line is string => Boolean(line));
}
