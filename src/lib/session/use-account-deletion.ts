import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { useTranslation } from "@/i18n/use-translation";
import { haptic } from "@/lib/haptics";
import { apiRequest, qk } from "@/lib/query";

import {
  DELETE_ACCOUNT_PATH,
  DELETION_STATUS_PATH,
  deletionFailureOf,
  deletionView,
  statusAfterRefusal,
  type DeletionStatus,
} from "./account-deletion";
import { showSignedOutNotice } from "./signed-out-notice";
import { useSignedOutWipe } from "./signed-out-wipe";

export type UseAccountDeletionOptions = { wipe?: () => Promise<void> };

/**
 * The Delete account sheet: the check, the password, and the delete. It words its own failures
 * rather than going through the write-failure handler. On 204 the server session is already gone,
 * so it runs the Signed-out wipe directly instead of `signOut()`.
 */
export function useAccountDeletion({ wipe }: UseAccountDeletionOptions = {}) {
  const { t } = useTranslation();
  const copy = t.settings.deleteAccount;
  const queryClient = useQueryClient();
  const deletedWipe = useSignedOutWipe("account-deleted");
  const runWipe = wipe ?? deletedWipe;

  const status = useQuery({
    queryKey: qk.accountDeletion(),
    queryFn: ({ signal }) => apiRequest<DeletionStatus>(DELETION_STATUS_PATH, { signal }),
    // A member removed on the web a moment ago unblocks the delete, so the sheet always asks.
    staleTime: 0,
  });

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inFlightRef = useRef(false);

  const editPassword = useCallback((value: string) => {
    setPassword(value);
    setPasswordError(null);
    setError(null);
    setRetry(false);
  }, []);

  const remove = useCallback(async () => {
    if (inFlightRef.current || password === "") return;
    inFlightRef.current = true;
    setDeleting(true);
    setPasswordError(null);
    setError(null);
    setRetry(false);
    haptic("tap");

    try {
      await apiRequest<void>(DELETE_ACCOUNT_PATH, { method: "POST", body: { password } });
    } catch (caught: unknown) {
      inFlightRef.current = false;
      setDeleting(false);
      const failure = deletionFailureOf(caught);
      if (!failure) return;
      const retryable = failure.kind === "unanswered" || failure.kind === "server";
      haptic(retryable ? "error" : "warning");

      if (failure.kind === "wrong-password") {
        setPasswordError(copy.wrongPassword);
      } else if (failure.kind === "blocked" || failure.kind === "reauth") {
        setPassword("");
        queryClient.setQueryData<DeletionStatus>(qk.accountDeletion(), (current) =>
          statusAfterRefusal(current, failure)
        );
        void queryClient.invalidateQueries({ queryKey: qk.accountDeletion() });
      } else if (retryable) {
        setError(failure.kind === "unanswered" ? t.sync.unreachable : copy.failed);
        setRetry(true);
      } else {
        setError(failure.message ?? copy.failed);
      }
      return;
    }

    haptic("success");
    // Set first: a 401 elsewhere may already be running a plain wipe that this one joins.
    showSignedOutNotice("account-deleted");
    await runWipe();
  }, [copy, password, queryClient, runWipe, t]);

  return {
    view: deletionView(status.data, status.isError),
    reread: status.refetch,
    password,
    setPassword: editPassword,
    passwordError,
    error,
    retry,
    deleting,
    remove,
    canDelete: password !== "" && !deleting,
  };
}
