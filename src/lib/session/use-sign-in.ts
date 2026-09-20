import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";

import { useTranslation } from "@/i18n/use-translation";

import { authClient } from "./auth-client";
import { useSetRootRoute } from "./root-route-context";

/** Only what the app reads of the answer: the auth client's own shape is a union per plugin. */
export type SignInAnswer = {
  data?: unknown;
  error?: { message?: string } | null;
};

type TwoFactorChallenge = { twoFactorRedirect?: boolean; twoFactorMethods?: string[] };

export type SignInWithEmail = (credentials: {
  email: string;
  password: string;
}) => Promise<SignInAnswer>;

const signInThroughAuthClient: SignInWithEmail = (credentials) =>
  authClient.signIn.email(credentials);

/** The methods the server offered, or nothing when it handed back a session instead. */
function offeredMethods(data: unknown): string[] | null {
  const challenge = (data ?? {}) as TwoFactorChallenge;
  if (!challenge.twoFactorRedirect) return null;
  return Array.isArray(challenge.twoFactorMethods) ? challenge.twoFactorMethods : [];
}

function twoFactorHref(methods: string[]): Href {
  // The two-factor route arrives with a later ticket, so the typed route needs the cast.
  return `/two-factor?methods=${encodeURIComponent(methods.join(","))}` as Href;
}

/**
 * The sign-in form's behaviour: the two fields, what the server answered, and where that answer
 * sends the app.
 */
export function useSignIn(signIn: SignInWithEmail = signInThroughAuthClient) {
  const { t } = useTranslation();
  const setRootRoute = useSetRootRoute();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledIn = email.trim() !== "" && password !== "";

  const submit = useCallback(async () => {
    if (loading || !filledIn) return;
    setError(null);
    setLoading(true);
    try {
      const answer = await signIn({ email: email.trim(), password });
      const methods = offeredMethods(answer.data);
      if (answer.error) {
        setError(answer.error.message ?? t.auth.signIn.failed);
      } else if (methods) {
        router.push(twoFactorHref(methods));
      } else {
        // The guards read the root route, so it moves before the shell is navigated to, and the
        // button stays in its loading state because this screen is on its way out.
        setRootRoute("signed-in");
        router.replace("/dashboard");
        return;
      }
    } catch (cause: unknown) {
      // The request never reached the server, so there is no answer of its own to show.
      console.error("The sign-in request failed.", cause);
      setError(t.sync.unreachable);
    }
    setLoading(false);
  }, [email, filledIn, loading, password, setRootRoute, signIn, t]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    submit,
    canSubmit: filledIn && !loading,
  };
}
