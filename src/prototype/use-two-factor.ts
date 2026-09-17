/* eslint-disable react-hooks/set-state-in-effect -- prototype: presets from the switcher */
import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/prototype/i18n";
import {
  defaultTwoFactorMethod,
  isChallengeDead,
  stubSendOtp,
  stubVerify,
  type TwoFactorMethod,
} from "@/prototype/stub-auth";

export type TwoFactorPreset = "idle" | "sent" | "error" | "dead";

const RESEND_COOLDOWN_S = 30;

type Options = { methods: TwoFactorMethod[]; preset: TwoFactorPreset; onSuccess: () => void };

// Port of the web's two-factor state machine against the stub.
export function useTwoFactor({ methods, preset, onSuccess }: Options) {
  const { t } = useT();
  const [method, setMethodState] = useState<TwoFactorMethod>(() => defaultTwoFactorMethod(methods));
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dead, setDead] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const sendOtp = useCallback(async () => {
    setError(null);
    setInfo(null);
    setSending(true);
    await stubSendOtp();
    setSending(false);
    setInfo(t.twoFactor.sent);
    setCooldown(RESEND_COOLDOWN_S);
  }, [t]);

  const autoSent = useRef(false);
  useEffect(() => {
    if (method !== "otp" || autoSent.current) return;
    autoSent.current = true;
    void sendOtp();
  }, [method, sendOtp]);

  const methodsKey = methods.join(",");
  useEffect(() => {
    setMethodState(defaultTwoFactorMethod(methodsKey.split(",") as TwoFactorMethod[]));
    setCode("");
  }, [methodsKey]);

  useEffect(() => {
    switch (preset) {
      case "idle":
        setError(null);
        setInfo(null);
        setDead(false);
        break;
      case "sent":
        setError(null);
        setInfo(t.twoFactor.sent);
        setDead(false);
        setCooldown(RESEND_COOLDOWN_S);
        break;
      case "error":
        setError(t.twoFactor.errors.invalidCode);
        setInfo(null);
        setDead(false);
        break;
      case "dead":
        setError(t.twoFactor.errors.challengeExpired);
        setInfo(null);
        setDead(true);
        break;
    }
  }, [preset, t]);

  const setMethod = useCallback((next: TwoFactorMethod) => {
    setMethodState(next);
    setCode("");
    setError(null);
    setInfo(null);
  }, []);

  const submit = useCallback(
    async (override?: string) => {
      const value = (override ?? code).trim();
      if (loading || dead || value === "") return;
      setError(null);
      setInfo(null);
      setLoading(true);
      const result = await stubVerify(value);
      setLoading(false);
      if ("error" in result) {
        const key = result.error;
        setError(
          key === "tooManyAttempts" && method === "otp"
            ? t.twoFactor.errors.tooManyAttemptsOtp
            : t.twoFactor.errors[key]
        );
        if (isChallengeDead(key, method)) setDead(true);
      } else {
        onSuccess();
      }
    },
    [code, dead, loading, method, onSuccess, t]
  );

  const description =
    method === "totp"
      ? t.twoFactor.totpDescription
      : method === "otp"
        ? t.twoFactor.otpDescription
        : t.twoFactor.backupDescription;

  return {
    method,
    setMethod,
    code,
    setCode,
    loading,
    error,
    info,
    dead,
    cooldown,
    sending,
    sendOtp,
    submit,
    description,
    offered: { totp: methods.includes("totp"), otp: methods.includes("otp"), backup: true },
    canSubmit: code.trim() !== "" && !dead && !loading,
  };
}
