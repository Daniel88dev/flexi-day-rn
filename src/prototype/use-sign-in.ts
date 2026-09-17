/* eslint-disable react-hooks/set-state-in-effect -- prototype: presets from the switcher */
import { useCallback, useEffect, useState } from "react";

import { useT } from "@/prototype/i18n";
import { stubSignIn, type TwoFactorMethod } from "@/prototype/stub-auth";

export type SignInPreset = "idle" | "loading" | "error";

type Options = {
  preset: SignInPreset;
  onSuccess: () => void;
  onTwoFactor: (methods: TwoFactorMethod[]) => void;
};

export function useSignIn({ preset, onSuccess, onTwoFactor }: Options) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(preset === "loading");
    setError(preset === "error" ? t.signIn.invalid : null);
  }, [preset, t]);

  const submit = useCallback(async () => {
    if (loading || email.trim() === "" || password === "") return;
    setError(null);
    setLoading(true);
    const result = await stubSignIn(email.trim(), password);
    setLoading(false);
    if ("error" in result) setError(t.signIn.invalid);
    else if ("twoFactorRedirect" in result) onTwoFactor(result.methods);
    else onSuccess();
  }, [email, loading, onSuccess, onTwoFactor, password, t]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    submit,
    canSubmit: email.trim() !== "" && password !== "",
  };
}
