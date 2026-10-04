import { googleAdapter } from "./google";
import { microsoftAdapter } from "./microsoft";
import type { ProviderAdapter, SocialProvider } from "./types";

export type { ProviderAdapter, ProviderOutcome, SocialProvider, TokenOutcome } from "./types";

/** The order the sign-in screen stacks them in: Apple's guidelines put no provider above Apple. */
export const SOCIAL_PROVIDERS: readonly SocialProvider[] = ["apple", "google", "microsoft"];

export const PROVIDER_NAMES: Record<SocialProvider, string> = {
  apple: "Apple",
  google: "Google",
  microsoft: "Microsoft",
};

function placeholder(provider: SocialProvider): ProviderAdapter {
  return {
    provider,
    signIn: async () => ({
      kind: "failed",
      error: new Error(`${PROVIDER_NAMES[provider]} sign-in is not available yet.`),
    }),
  };
}

export const PROVIDER_ADAPTERS: Record<SocialProvider, ProviderAdapter> = {
  apple: placeholder("apple"),
  google: googleAdapter,
  microsoft: microsoftAdapter,
};
