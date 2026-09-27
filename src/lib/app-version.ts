/** The version About shows, `1.4.0 (37)` the way iOS writes a version and its build. */
export function appVersionLabel(version: string | null, build: string | null): string | null {
  if (!version) return null;
  return build ? `${version} (${build})` : version;
}
