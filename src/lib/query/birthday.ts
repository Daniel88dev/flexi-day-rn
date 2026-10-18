import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { BirthdayShareGroup, MyBirthday } from "@/lib/birthdays/birthday";
import { pull } from "@/lib/local-store";

import { ApiError } from "./failure";
import { qk } from "./keys";
import { apiRequest } from "./runtime";
import { useWriteFailure } from "./use-write-failure";

export type BirthdaySettings = {
  birthday: MyBirthday | null;
  /** Whether the share switch may turn on: one of the user's groups is on a paid plan. */
  canShare: boolean;
  /** The paid and lapsed groups a shared birthday shows in today. */
  shareGroups: BirthdayShareGroup[];
};

const BIRTHDAY_PATH = "/api/users/me/birthday";

export const BIRTHDAY_SHARE_PLAN_REQUIRED = "BIRTHDAY_SHARE_PLAN_REQUIRED";

function refusedShare(error: unknown): boolean {
  return error instanceof ApiError && error.context?.code === BIRTHDAY_SHARE_PLAN_REQUIRED;
}

export function useMyBirthday() {
  return useQuery({
    queryKey: qk.myBirthday(),
    queryFn: ({ signal }) => apiRequest<BirthdaySettings>(BIRTHDAY_PATH, { signal }),
  });
}

/**
 * Saves the whole birthday. The calendar reads the Local store, so a saved one is pulled in. A
 * share the plan refuses is worded where the switch is, as on the web, and the plan state read
 * again; any other failure goes to the write failure handler.
 */
export function useSaveMyBirthday() {
  const queryClient = useQueryClient();
  const writeFailure = useWriteFailure();
  const [planRefused, setPlanRefused] = useState(false);

  const mutation = useMutation({
    mutationFn: (birthday: MyBirthday) =>
      apiRequest<BirthdaySettings>(BIRTHDAY_PATH, { method: "PUT", body: birthday }),
    onMutate: () => setPlanRefused(false),
    onSuccess: (saved) => {
      queryClient.setQueryData(qk.myBirthday(), saved);
      void pull("after-write");
    },
    onError: (error, birthday) => {
      if (refusedShare(error)) {
        setPlanRefused(true);
        void queryClient.invalidateQueries({ queryKey: qk.myBirthday() });
        return;
      }
      writeFailure(error, {
        queryKeys: [qk.myBirthday()],
        retry: () => mutation.mutate(birthday),
      });
    },
  });

  return {
    save: (birthday: MyBirthday, options?: { onSaved?: () => void }) =>
      mutation.mutate(birthday, { onSuccess: () => options?.onSaved?.() }),
    saving: mutation.isPending,
    /** The birthday being saved, so a switch shows the change while it is in flight. */
    pending: mutation.isPending ? mutation.variables : undefined,
    planRefused,
  };
}

export function useRemoveMyBirthday() {
  const queryClient = useQueryClient();
  const writeFailure = useWriteFailure();

  const mutation = useMutation({
    mutationFn: () => apiRequest<void>(BIRTHDAY_PATH, { method: "DELETE" }),
    onSuccess: () => void pull("after-write"),
    onError: (error) =>
      writeFailure(error, { queryKeys: [qk.myBirthday()], retry: () => mutation.mutate() }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.myBirthday() }),
  });

  return {
    remove: (options?: { onRemoved?: () => void }) =>
      mutation.mutate(undefined, { onSuccess: () => options?.onRemoved?.() }),
    removing: mutation.isPending,
  };
}
