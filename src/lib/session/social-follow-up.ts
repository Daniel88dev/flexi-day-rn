import type { ApiRequest } from "@/lib/query/request";
import { apiRequest } from "@/lib/query/runtime";

import type { AfterSocialSignIn } from "./use-social-sign-in";

export const APPLE_AUTHORIZATION_PATH = "/api/users/me/apple-authorization";

/**
 * Apple's authorization code goes to the backend, which trades it for the refresh token that
 * deleting the account revokes.
 */
export function createSocialFollowUp(request: ApiRequest): AfterSocialSignIn {
  return async (provider, outcome) => {
    if (provider !== "apple" || !outcome.authorizationCode) return;
    await request(APPLE_AUTHORIZATION_PATH, {
      method: "POST",
      body: { authorizationCode: outcome.authorizationCode },
    });
  };
}

export const socialFollowUp = createSocialFollowUp(apiRequest);
