/** The part of the name the greeting uses. */
export function firstName(name: string | undefined, fallback: string): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : fallback;
}

export function initials(name: string | undefined): string {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
