import { useCallback, useReducer, useState } from "react";

import { useTranslation } from "@/i18n/use-translation";
import { haptic } from "@/lib/haptics";

import { authClient } from "./auth-client";
import { readsSessionBack, useRefreshSession } from "./revalidate-session";
import {
  initialFlowState,
  nextFlowState,
  swapsSession,
  totpSecret,
  twoFactorSettingsRefusal,
  type TwoFactorFlow,
  type TwoFactorSettingsStage,
} from "./two-factor-settings";

type AuthError = { status?: number; code?: string | null; message?: string | null };

export type TwoFactorSettingsAnswer<T = unknown> = {
  data?: T | null;
  error?: AuthError | null;
};

/** The better-auth calls the Settings flows make, so a test hands in a fake instead of the client. */
export type TwoFactorSettingsAuth = {
  enable(body: {
    password: string;
    method: "totp";
  }): Promise<
    TwoFactorSettingsAnswer<{ method: string; totpURI?: string; backupCodes?: string[] }>
  >;
  getTotpUri(body: { password: string }): Promise<TwoFactorSettingsAnswer<{ totpURI: string }>>;
  generateBackupCodes(body: {
    password: string;
  }): Promise<TwoFactorSettingsAnswer<{ backupCodes: string[] }>>;
  disable(body: { password: string }): Promise<TwoFactorSettingsAnswer<{ status: boolean }>>;
  sendOtp(): Promise<TwoFactorSettingsAnswer>;
  verifyTotp(body: { code: string }): Promise<TwoFactorSettingsAnswer>;
  verifyOtp(body: { code: string }): Promise<TwoFactorSettingsAnswer>;
};

const throughAuthClient: TwoFactorSettingsAuth = {
  enable: (body) => authClient.twoFactor.enable(body),
  getTotpUri: (body) => authClient.twoFactor.getTotpUri(body),
  generateBackupCodes: (body) => authClient.twoFactor.generateBackupCodes(body),
  disable: (body) => authClient.twoFactor.disable(body),
  sendOtp: () => authClient.twoFactor.sendOtp(),
  verifyTotp: (body) => authClient.twoFactor.verifyTotp(body),
  verifyOtp: (body) => authClient.twoFactor.verifyOtp(body),
};

type PasswordAnswer = {
  method?: string;
  status?: boolean;
  totpURI?: string;
  backupCodes?: string[];
};

export type UseTwoFactorFlowOptions = {
  auth?: TwoFactorSettingsAuth;
  refreshSession?: () => Promise<void>;
};

/**
 * One Settings flow's steps and calls, in the web's order. Enable-verify and disable swap the
 * session; the answer carries the new cookie for the jar, and the phone reads its session back.
 */
export function useTwoFactorFlow(
  flow: TwoFactorFlow,
  { auth = throughAuthClient, refreshSession }: UseTwoFactorFlowOptions = {}
) {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  const refreshThroughAuthClient = useRefreshSession();
  const refresh = refreshSession ?? refreshThroughAuthClient;
  const [state, dispatch] = useReducer(nextFlowState, flow, initialFlowState);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clearMessages = useCallback(() => {
    setPasswordError(null);
    setCodeError(null);
    setError(null);
    setInfo(null);
  }, []);

  const editPassword = useCallback((value: string) => {
    setPassword(value);
    setPasswordError(null);
    setError(null);
  }, []);

  const editCode = useCallback((value: string) => {
    setCode(value);
    setCodeError(null);
    setError(null);
  }, []);

  const refuse = useCallback(
    async (stage: TwoFactorSettingsStage, answer: AuthError, swapping: boolean) => {
      haptic("error");
      const refusal = twoFactorSettingsRefusal(stage, answer);
      const sessionLost = refusal.field === "session";
      if (readsSessionBack({ sessionLost, status: answer.status, swapping })) await refresh();
      if (sessionLost) return;
      if (refusal.field === "password") setPasswordError(copy.errors.wrongPassword);
      else if (refusal.field === "code") {
        setCode("");
        setCodeError(
          refusal.key === "tooManyAttempts"
            ? t.auth.twoFactor.errors.tooManyAttemptsOtp
            : t.auth.twoFactor.errors[refusal.key]
        );
      } else if (refusal.key === "server") setError(refusal.message);
      else if (refusal.key === "rateLimited") setError(t.auth.twoFactor.errors.rateLimited);
      else setError(copy.errors[refusal.key]);
    },
    [copy, refresh, t]
  );

  const attempt = useCallback(
    async (run: () => Promise<void>) => {
      if (busy) return;
      clearMessages();
      setBusy(true);
      try {
        await run();
      } catch (cause: unknown) {
        // The request never reached the server, so there is no answer of its own to show.
        console.error("The two-factor settings request failed.", cause);
        setError(t.sync.unreachable);
      }
      setBusy(false);
    },
    [busy, clearMessages, t]
  );

  const submitPassword = useCallback(
    () =>
      attempt(async () => {
        if (state.step !== "password" || password === "") return;
        const swapping = swapsSession(state);
        let answer: TwoFactorSettingsAnswer<PasswordAnswer>;
        if (flow === "enable") answer = await auth.enable({ password, method: "totp" });
        else if (flow === "authenticator") answer = await auth.getTotpUri({ password });
        else if (flow === "backupCodes") answer = await auth.generateBackupCodes({ password });
        else answer = await auth.disable({ password });

        if (answer.error) return refuse("password", answer.error, swapping);
        const data = answer.data ?? {};
        // Only the totp branch of enable answers with a secret and codes.
        if (flow === "enable" && !(data.totpURI && data.backupCodes)) {
          setError(copy.errors.actionFailed);
          return;
        }
        if (swapping) await refresh();
        haptic(flow === "disable" ? "success" : "selection");
        setPassword("");
        dispatch({
          type: "passwordAccepted",
          backupCodes: data.backupCodes,
          totpURI: data.totpURI,
        });
      }),
    [attempt, auth, copy, flow, password, refresh, refuse, state]
  );

  const sendEmailCode = useCallback(
    () =>
      attempt(async () => {
        const answer = await auth.sendOtp();
        if (answer.error) return refuse("send", answer.error, false);
        setInfo(copy.sent);
        dispatch({ type: "emailCodeSent" });
      }),
    [attempt, auth, copy, refuse]
  );

  const verify = useCallback(
    (override?: string) =>
      attempt(async () => {
        const value = (override ?? code).trim();
        if (value === "") return;
        if (state.step !== "authenticator" && state.step !== "emailCode") return;
        const swapping = swapsSession(state);
        const answer =
          state.step === "authenticator"
            ? await auth.verifyTotp({ code: value })
            : await auth.verifyOtp({ code: value });
        if (answer.error) return refuse("code", answer.error, swapping);
        if (swapping) await refresh();
        haptic("success");
        setCode("");
        dispatch({ type: "verified" });
      }),
    [attempt, auth, code, refresh, refuse, state]
  );

  const saveCodes = useCallback(() => {
    clearMessages();
    dispatch({ type: "codesSaved" });
  }, [clearMessages]);

  const chooseAuthenticator = useCallback(() => {
    clearMessages();
    dispatch({ type: "authenticatorChosen" });
  }, [clearMessages]);

  return {
    state,
    secret: state.totpURI ? totpSecret(state.totpURI) : null,
    password,
    setPassword: editPassword,
    passwordError,
    code,
    setCode: editCode,
    codeError,
    error,
    info,
    busy,
    submitPassword,
    saveCodes,
    chooseAuthenticator,
    chooseEmail: sendEmailCode,
    resend: sendEmailCode,
    verify,
    canSubmitPassword: password !== "" && !busy,
    canVerify: code.trim() !== "" && !busy,
  };
}
