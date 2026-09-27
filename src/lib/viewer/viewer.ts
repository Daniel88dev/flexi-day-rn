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

/** The backend's `getAvatarColorForUserId`, so a person wears the same colour as on the web. */
export function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 50%)`;
}
