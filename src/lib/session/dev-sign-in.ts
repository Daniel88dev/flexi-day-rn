export const DASHBOARD = "/dashboard";

type Refusal = { status?: number; code?: string; message?: string };

export type AuthAnswer = { data?: unknown; error?: Refusal | null };

/** A dev sign-in link's ticket and landing path, its stray params already folded into `to`. */
export type DevSignInLink = { ticket: unknown; to?: unknown };

export type DevSignInSteps = {
  wipe: () => Promise<void>;
  redeem: (ticket: string) => Promise<AuthAnswer>;
  readSession: () => Promise<AuthAnswer>;
  signedIn: () => void;
  /** Opens the shell; `landing` is the screen to put over it, or null for the dashboard itself. */
  land: (landing: string | null) => void;
};

/**
 * `strayParams` is every other param of the link. expo-router decodes a deep link's query twice and
 * rejoins it with a raw `&`, so the params of `to`'s own query past the first arrive beside it.
 */
export function devSignInTarget(to: unknown, strayParams: Record<string, unknown> = {}): string {
  if (typeof to !== "string") return DASHBOARD;
  const inApp = to.startsWith("/") && !to.startsWith("//") && !to.includes("\\");
  if (!inApp) return DASHBOARD;

  const folded = Object.entries(strayParams).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value])
      .filter((item): item is string => typeof item === "string")
      .map((item) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
  );
  if (folded.length === 0) return to;
  return `${to}${to.includes("?") ? "&" : "?"}${folded.join("&")}`;
}

function describeRefusal(refusal: Refusal): string {
  if (refusal.code && refusal.message) return `${refusal.code}: ${refusal.message}`;
  return refusal.message ?? refusal.code ?? `HTTP ${refusal.status ?? "?"}`;
}

function describeThrown(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Signs the phone in with a dev sign-in ticket: the previous session goes first, the redeem
 * leaves its cookie in the auth client's jar, and the session read back fills the session cache.
 * Resolves to what went wrong, or `null` once it has landed.
 */
export async function devSignIn(
  { ticket, to }: DevSignInLink,
  steps: DevSignInSteps
): Promise<string | null> {
  if (typeof ticket !== "string" || ticket === "") return "The link carries no ticket.";

  await steps.wipe();
  try {
    const redeemed = await steps.redeem(ticket);
    if (redeemed.error) return describeRefusal(redeemed.error);
  } catch (cause: unknown) {
    return describeThrown(cause);
  }

  let failure: string | null = null;
  try {
    const session = await steps.readSession();
    if (session.error) failure = describeRefusal(session.error);
    else if (!session.data) failure = "The ticket was redeemed but the server reports no session.";
  } catch (cause: unknown) {
    failure = describeThrown(cause);
  }
  if (failure) {
    // The redeem already put a live cookie in the jar; staying signed out means letting it go.
    await steps.wipe();
    return failure;
  }

  steps.signedIn();
  const target = devSignInTarget(to);
  steps.land(target === DASHBOARD ? null : target);
  return null;
}

let landing: string | null = null;

/**
 * Where a dev sign-in goes past the dashboard. Most screens over the shell read the Local store,
 * which the shell opens itself, so the shell takes this once its store is open.
 */
export function setDevSignInLanding(href: string | null): void {
  landing = href;
}

export function takeDevSignInLanding(): string | null {
  const href = landing;
  landing = null;
  return href;
}
