export type SocialProvider = "apple" | "google" | "microsoft";

export type ProviderOutcome =
  | {
      kind: "token";
      idToken: string;
      nonce?: string;
      user?: { name?: { firstName?: string; lastName?: string } };
      authorizationCode?: string;
    }
  | { kind: "cancelled" }
  | { kind: "failed"; error: unknown };

export type TokenOutcome = Extract<ProviderOutcome, { kind: "token" }>;

/** One provider's native sheet, reduced to the id token better-auth verifies. */
export interface ProviderAdapter {
  provider: SocialProvider;
  signIn(): Promise<ProviderOutcome>;
}
