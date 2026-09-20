import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/i18n/use-translation";

import { authClient } from "./auth-client";
import { useSetRootRoute } from "./root-route-context";
import { clearSignedOutNotice } from "./signed-out-notice";
import {
  defaultTwoFactorMethod,
  isChallengeDead,
  twoFactorErrorKey,
  type TwoFactorMethod,
} from "./two-factor";

const RESEND_COOLDOWN_S = 30;

/** Only what the screen reads of an answer: the auth client's own shape is a union per plugin. */
export type TwoFactorAnswer = {
  error?: { status?: number; code?: string | null } | null;
};

/** The second-factor calls the screen makes, so a test hands it a fake instead of the client. */
export type TwoFactorAuth = {
  verifyTotp(body: { code: string }): Promise<TwoFactorAnswer>;
  verifyOtp(body: { code: string }): Promise<TwoFactorAnswer>;
  verifyBackupCode(body: { code: string }): Promise<TwoFactorAnswer>;
  sendOtp(): Promise<TwoFactorAnswer>;
};

export type CountdownClock = { setTimeout(run: () => void, ms: number): () => void };

const twoFactorThroughAuthClient: TwoFactorAuth = {
  verifyTotp: (body) => authClient.twoFactor.verifyTotp(body),
  verifyOtp: (body) => authClient.twoFactor.verifyOtp(body),
  verifyBackupCode: (body) => authClient.twoFactor.verifyBackupCode(body),
  sendOtp: () => authClient.twoFactor.sendOtp(),
};

const systemClock: CountdownClock = {
  setTimeout: (run, ms) => {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  },
};

export type UseTwoFactorOptions = {
  /** The second factors the server offered, as the sign-in response listed them. */
  methods: string[];
  auth?: TwoFactorAuth;
  clock?: CountdownClock;
};

/**
 * The web's two-factor state machine: the method in use, the code typed into it, one automatic
 * send for the emailed code, the resend cooldown, and what the server's refusal means.
 */
export function useTwoFactor({
  methods,
  auth = twoFactorThroughAuthClient,
  clock = systemClock,
}: UseTwoFactorOptions) {
  const { t } = useTranslation();
  const setRootRoute = useSetRootRoute();
  const [method, setMethodState] = useState<TwoFactorMethod>(() => defaultTwoFactorMethod(methods));
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [challengeDead, setChallengeDead] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    return clock.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
  }, [clock, cooldown]);

  const showRefusal = useCallback(
    (refusal: { status?: number; code?: string | null }, attempted: TwoFactorMethod) => {
      const key = twoFactorErrorKey(refusal.status, refusal.code);
      setError(
        key === "tooManyAttempts" && attempted === "otp"
          ? t.auth.twoFactor.errors.tooManyAttemptsOtp
          : t.auth.twoFactor.errors[key]
      );
      if (isChallengeDead(key, attempted)) setChallengeDead(true);
    },
    [t]
  );

  const canResend = !challengeDead && !sending && cooldown === 0;

  const sendOtp = useCallback(async () => {
    if (!canResend) return;
    setError(null);
    setInfo(null);
    setSending(true);
    try {
      const answer = await auth.sendOtp();
      if (answer.error) {
        showRefusal(answer.error, "otp");
      } else {
        setInfo(t.auth.twoFactor.sent);
        setCooldown(RESEND_COOLDOWN_S);
      }
    } catch (cause: unknown) {
      // The request never reached the server, so there is no answer of its own to show.
      console.error("The two-factor send failed.", cause);
      setError(t.sync.unreachable);
    }
    setSending(false);
  }, [auth, canResend, showRefusal, t]);

  // One automatic send when email is the factor in use; resends are manual.
  const autoSent = useRef(false);
  useEffect(() => {
    if (method !== "otp" || autoSent.current) return;
    autoSent.current = true;
    void sendOtp();
  }, [method, sendOtp]);

  const setMethod = useCallback((next: TwoFactorMethod) => {
    setMethodState(next);
    setCode("");
    setError(null);
    setInfo(null);
  }, []);

  const submit = useCallback(
    async (override?: string) => {
      const value = (override ?? code).trim();
      if (loading || challengeDead || value === "") return;
      setError(null);
      setInfo(null);
      setLoading(true);
      try {
        const body = { code: value };
        const answer =
          method === "totp"
            ? await auth.verifyTotp(body)
            : method === "otp"
              ? await auth.verifyOtp(body)
              : await auth.verifyBackupCode(body);
        if (answer.error) {
          showRefusal(answer.error, method);
        } else {
          clearSignedOutNotice();
          // The guards read the root route, so it moves before the shell is navigated to.
          setRootRoute("signed-in");
          router.replace("/dashboard");
          return;
        }
      } catch (cause: unknown) {
        // The request never reached the server, so there is no answer of its own to show.
        console.error("The two-factor request failed.", cause);
        setError(t.sync.unreachable);
      }
      setLoading(false);
    },
    [auth, challengeDead, code, loading, method, setRootRoute, showRefusal, t]
  );

  const description =
    method === "totp"
      ? t.auth.twoFactor.totpDescription
      : method === "otp"
        ? t.auth.twoFactor.otpDescription
        : t.auth.twoFactor.backupDescription;

  return {
    method,
    setMethod,
    code,
    setCode,
    loading,
    error,
    info,
    challengeDead,
    cooldown,
    sending,
    sendOtp,
    submit,
    description,
    offered: { totp: methods.includes("totp"), otp: methods.includes("otp") },
    canSubmit: code.trim() !== "" && !challengeDead && !loading,
    canResend,
  };
}
