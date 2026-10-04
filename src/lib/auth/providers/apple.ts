import {
  AppleAuthenticationScope,
  signInAsync,
  type AppleAuthenticationFullName,
} from "expo-apple-authentication";
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from "expo-crypto";

import type { ProviderAdapter, ProviderOutcome, TokenOutcome } from "./types";

const CANCELED_CODE = "ERR_REQUEST_CANCELED";

function isCancellation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === CANCELED_CODE
  );
}

function userFrom(fullName: AppleAuthenticationFullName | null): TokenOutcome["user"] {
  const name = {
    ...(fullName?.givenName ? { firstName: fullName.givenName } : {}),
    ...(fullName?.familyName ? { lastName: fullName.familyName } : {}),
  };
  return Object.keys(name).length > 0 ? { name } : undefined;
}

export function createAppleAdapter(): ProviderAdapter {
  return {
    provider: "apple",
    async signIn(): Promise<ProviderOutcome> {
      try {
        // The native sheet writes this string into the token's nonce claim as given, unlike
        // Apple's web flow, so the hash is also the value better-auth compares.
        const nonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, randomUUID());

        const credential = await signInAsync({
          requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
          nonce,
        });
        if (!credential.identityToken) {
          return { kind: "failed", error: new Error("Apple returned no identity token.") };
        }

        const user = userFrom(credential.fullName);
        return {
          kind: "token",
          idToken: credential.identityToken,
          nonce,
          ...(credential.authorizationCode
            ? { authorizationCode: credential.authorizationCode }
            : {}),
          ...(user ? { user } : {}),
        };
      } catch (error: unknown) {
        if (isCancellation(error)) return { kind: "cancelled" };
        return { kind: "failed", error };
      }
    },
  };
}

export const appleAdapter = createAppleAdapter();
