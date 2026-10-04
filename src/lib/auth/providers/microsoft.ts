import {
  AuthRequest,
  type DiscoveryDocument,
  exchangeCodeAsync,
  fetchDiscoveryAsync,
} from "expo-auth-session";
import { randomUUID } from "expo-crypto";
import { maybeCompleteAuthSession } from "expo-web-browser";

import { MICROSOFT_CLIENT_ID, MICROSOFT_REDIRECT_URI } from "../provider-config";
import type { ProviderAdapter, ProviderOutcome } from "./types";

maybeCompleteAuthSession();

const MICROSOFT_ISSUER = "https://login.microsoftonline.com/common/v2.0";

// No offline_access: Microsoft then issues no refresh token for the phone to hold.
const MICROSOFT_SCOPES = ["openid", "profile", "email"];

export function createMicrosoftAdapter(): ProviderAdapter {
  let discovery: DiscoveryDocument | null = null;

  return {
    provider: "microsoft",
    async signIn(): Promise<ProviderOutcome> {
      try {
        discovery ??= await fetchDiscoveryAsync(MICROSOFT_ISSUER);

        const nonce = randomUUID();
        const request = new AuthRequest({
          clientId: MICROSOFT_CLIENT_ID,
          redirectUri: MICROSOFT_REDIRECT_URI,
          scopes: MICROSOFT_SCOPES,
          usePKCE: true,
          extraParams: { nonce },
        });

        const result = await request.promptAsync(discovery);
        if (result.type === "cancel" || result.type === "dismiss") return { kind: "cancelled" };
        if (result.type === "error") {
          return { kind: "failed", error: result.error ?? new Error(result.params.error) };
        }
        if (result.type !== "success") {
          return {
            kind: "failed",
            error: new Error(`Microsoft sign-in ended with ${result.type}.`),
          };
        }

        const code = result.params.code;
        if (!code || !request.codeVerifier) {
          return { kind: "failed", error: new Error("Microsoft returned no authorization code.") };
        }

        // exchangeCodeAsync does not send the PKCE verifier on its own.
        const tokens = await exchangeCodeAsync(
          {
            clientId: MICROSOFT_CLIENT_ID,
            code,
            redirectUri: MICROSOFT_REDIRECT_URI,
            extraParams: { code_verifier: request.codeVerifier },
          },
          discovery
        );
        if (!tokens.idToken) {
          return { kind: "failed", error: new Error("Microsoft returned no id token.") };
        }
        return { kind: "token", idToken: tokens.idToken, nonce };
      } catch (error: unknown) {
        return { kind: "failed", error };
      }
    },
  };
}

export const microsoftAdapter = createMicrosoftAdapter();
