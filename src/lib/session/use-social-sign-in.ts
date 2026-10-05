import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";

import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import {
  PROVIDER_ADAPTERS,
  PROVIDER_NAMES,
  type ProviderAdapter,
  type ProviderOutcome,
  type SocialProvider,
  type TokenOutcome,
} from "@/lib/auth/providers";
import { openWebPage, WEB_PATHS } from "@/lib/web";

import { authClient } from "./auth-client";
import { useSetRootRoute } from "./root-route-context";
import { clearSignedOutNotice } from "./signed-out-notice";
import { socialFollowUp } from "./social-follow-up";

export type SocialSignInRequest = {
  provider: SocialProvider;
  idToken: {
    token: string;
    nonce: string | undefined;
    user: TokenOutcome["user"];
  };
};

/** Only what the app reads of the answer; better-fetch spreads the error body beside the status. */
export type SocialSignInAnswer = {
  data?: unknown;
  error?: { status?: number; code?: string; message?: string } | null;
};

export type RequestSocialSignIn = (request: SocialSignInRequest) => Promise<SocialSignInAnswer>;

export type AfterSocialSignIn = (provider: SocialProvider, outcome: TokenOutcome) => unknown;

const requestThroughAuthClient: RequestSocialSignIn = (request) =>
  authClient.signIn.social(request);

type Failure =
  | { kind: "notLinked"; provider: SocialProvider }
  | { kind: "cancelled" }
  | { kind: "unreachable" }
  | { kind: "generic" };

export type SocialSignInNotice = {
  message: string;
  action?: { label: string; onPress: () => void; testID: string };
};

function noticeFor(failure: Failure, t: Dictionary): SocialSignInNotice {
  switch (failure.kind) {
    case "notLinked":
      return {
        message: t.auth.signIn.accountNotLinked(PROVIDER_NAMES[failure.provider]),
        action: {
          label: t.auth.signIn.openSettings,
          onPress: () => void openWebPage(WEB_PATHS.settings),
          testID: "sign-in-notice-action",
        },
      };
    case "cancelled":
      return { message: t.auth.signIn.cancelled };
    case "unreachable":
      return { message: t.sync.unreachable };
    case "generic":
      return { message: t.auth.signIn.generic };
  }
}

function isLinkError(answer: SocialSignInAnswer): boolean {
  return answer.error?.status === 401 && answer.error.code === "OAUTH_LINK_ERROR";
}

async function askProvider(adapter: ProviderAdapter): Promise<ProviderOutcome> {
  try {
    return await adapter.signIn();
  } catch (error: unknown) {
    return { kind: "failed", error };
  }
}

function runFollowUp(
  afterSignIn: AfterSocialSignIn,
  provider: SocialProvider,
  outcome: TokenOutcome
): void {
  Promise.resolve()
    .then(() => afterSignIn(provider, outcome))
    .catch((cause: unknown) => {
      if (__DEV__) console.warn(`The ${provider} follow-up after sign-in failed.`, cause);
    });
}

/**
 * The provider buttons' behaviour: one provider sheet at a time, its token handed to better-auth's
 * own id-token sign-in, and the outcome turned into a landing or a notice.
 */
export function useSocialSignIn({
  adapters = PROVIDER_ADAPTERS,
  requestSocialSignIn = requestThroughAuthClient,
  afterSignIn = socialFollowUp,
}: {
  adapters?: Record<SocialProvider, ProviderAdapter>;
  requestSocialSignIn?: RequestSocialSignIn;
  afterSignIn?: AfterSocialSignIn;
} = {}) {
  const { t } = useTranslation();
  const setRootRoute = useSetRootRoute();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  // State lags a render behind, and a second tap can land before the first one re-renders.
  const inFlightRef = useRef(false);

  const signIn = useCallback(
    async (provider: SocialProvider) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setPending(provider);
      setFailure(null);

      const finish = (next: Failure) => {
        setFailure(next);
        setPending(null);
        inFlightRef.current = false;
      };

      const outcome = await askProvider(adapters[provider]);
      if (outcome.kind === "cancelled") return finish({ kind: "cancelled" });
      if (outcome.kind === "failed") {
        console.error(`The ${provider} sign-in sheet failed.`, outcome.error);
        return finish({ kind: "generic" });
      }

      let answer: SocialSignInAnswer;
      try {
        answer = await requestSocialSignIn({
          provider,
          idToken: { token: outcome.idToken, nonce: outcome.nonce, user: outcome.user },
        });
      } catch (cause: unknown) {
        console.error("The social sign-in request failed.", cause);
        return finish({ kind: "unreachable" });
      }

      if (answer.error) {
        return finish(isLinkError(answer) ? { kind: "notLinked", provider } : { kind: "generic" });
      }

      clearSignedOutNotice();
      // As with email sign-in: the root route moves before the navigation, and the button keeps
      // its in-flight state because this screen is on its way out.
      setRootRoute("signed-in");
      router.replace("/dashboard");
      runFollowUp(afterSignIn, provider, outcome);
    },
    [adapters, afterSignIn, setRootRoute, requestSocialSignIn]
  );

  return { signIn, pending, notice: failure ? noticeFor(failure, t) : null };
}
