import { useCallback, useState } from "react";

import { useTranslation } from "@/i18n/use-translation";
import { haptic } from "@/lib/haptics";

import { authClient } from "./auth-client";
import { changePasswordRefusal, newPasswordProblem } from "./change-password";
import { readsSessionBack, UNAUTHORIZED, useRefreshSession } from "./revalidate-session";

export type ChangePasswordAnswer = {
  data?: unknown;
  error?: { status?: number; code?: string | null; message?: string | null } | null;
};

export type ChangePassword = (body: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: true;
}) => Promise<ChangePasswordAnswer>;

export type ChangePasswordErrors = {
  current?: string;
  next?: string;
  confirm?: string;
  form?: string;
};

const changeThroughAuthClient: ChangePassword = (body) => authClient.changePassword(body);

export type UseChangePasswordOptions = {
  change?: ChangePassword;
  refreshSession?: () => Promise<void>;
};

// `revokeOtherSessions` deletes this phone's Native session too; the answer carries its
// replacement, which the expo plugin puts in the cookie jar.
export function useChangePassword({
  change = changeThroughAuthClient,
  refreshSession,
}: UseChangePasswordOptions = {}) {
  const { t } = useTranslation();
  const refreshThroughAuthClient = useRefreshSession();
  const refresh = refreshSession ?? refreshThroughAuthClient;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [loading, setLoading] = useState(false);
  const [changed, setChanged] = useState(false);

  const editing = useCallback(
    (fields: (keyof ChangePasswordErrors)[], set: (value: string) => void) => (value: string) => {
      set(value);
      setErrors((standing) => {
        const rest = { ...standing };
        for (const field of [...fields, "form" as const]) delete rest[field];
        return rest;
      });
    },
    []
  );

  const filledIn = current !== "" && next !== "" && confirm !== "";

  const submit = useCallback(async () => {
    if (loading || !filledIn) return;
    const copy = t.settings.password.errors;
    const problem = newPasswordProblem({ next, confirm });
    if (problem) {
      setErrors(problem === "mismatch" ? { confirm: copy.mismatch } : { next: copy.tooShort });
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const answer = await change({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (!answer.error) {
        haptic("success");
        await refresh();
        setCurrent("");
        setNext("");
        setConfirm("");
        setChanged(true);
        setLoading(false);
        return;
      }
      haptic("error");
      const status = answer.error.status ?? 0;
      // The change always swaps the session, whether or not the rest of it landed.
      if (readsSessionBack({ sessionLost: status === UNAUTHORIZED, status, swapping: true })) {
        await refresh();
      }
      if (status !== UNAUTHORIZED) {
        const refusal = changePasswordRefusal(answer.error.code);
        setErrors(
          refusal === "wrongCurrent"
            ? { current: copy.wrongCurrent }
            : refusal
              ? { next: copy[refusal] }
              : { form: answer.error.message || copy.failed }
        );
      }
    } catch (cause: unknown) {
      // The request never reached the server, so there is no answer of its own to show.
      console.error("The change-password request failed.", cause);
      setErrors({ form: t.sync.unreachable });
    }
    setLoading(false);
  }, [change, confirm, current, filledIn, loading, next, refresh, t]);

  return {
    current,
    setCurrent: editing(["current"], setCurrent),
    next,
    setNext: editing(["next", "confirm"], setNext),
    confirm,
    setConfirm: editing(["confirm"], setConfirm),
    errors,
    loading,
    changed,
    submit,
    canSubmit: filledIn && !loading,
  };
}
