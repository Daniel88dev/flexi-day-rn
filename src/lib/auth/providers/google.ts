import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "../provider-config";
import type { ProviderAdapter, ProviderOutcome } from "./types";

export function createGoogleAdapter(): ProviderAdapter {
  let configured = false;

  return {
    provider: "google",
    async signIn(): Promise<ProviderOutcome> {
      try {
        if (!configured) {
          GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            iosClientId: GOOGLE_IOS_CLIENT_ID,
          });
          configured = true;
        }

        const response = await GoogleSignin.signIn();
        if (response.type === "cancelled") return { kind: "cancelled" };
        if (response.data.idToken) return { kind: "token", idToken: response.data.idToken };
        return { kind: "failed", error: new Error("Google returned no id token.") };
      } catch (error: unknown) {
        return { kind: "failed", error };
      }
    },
  };
}

export const googleAdapter = createGoogleAdapter();
