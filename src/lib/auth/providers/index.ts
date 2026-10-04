import { appleAdapter } from "./apple";
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

export const PROVIDER_ADAPTERS: Record<SocialProvider, ProviderAdapter> = {
  apple: appleAdapter,
  google: googleAdapter,
  microsoft: microsoftAdapter,
};
