export type HeldInvite = { token: string; invitedEmail: string | null };

// Memory only: the token is the invite's secret, so a killed app forgets it and the link is
// tapped again. The signed-out wipe leaves it alone, so "Sign out and continue" carries it across.
let held: HeldInvite | null = null;

export function holdInvite(invite: HeldInvite): void {
  held = invite;
}

export function heldInvite(): HeldInvite | null {
  return held;
}

/** The shell takes this once its store is open and puts the Join screen back over it. */
export function takeHeldInvite(): HeldInvite | null {
  const invite = held;
  held = null;
  return invite;
}

export function clearHeldInvite(): void {
  held = null;
}
