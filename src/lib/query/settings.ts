import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "./keys";
import { apiRequest } from "./runtime";
import { useWriteFailure } from "./use-write-failure";

export type MySettings = {
  emailNotifications: boolean;
  dashboardScope: "MINE" | "GROUP";
  dashboardGroupId: string | null;
  dashboardCalendarView: "LANES" | "STRIPES";
  attendanceLocationNoticeDismissed: boolean;
};

/** The backend takes any subset of the fields and keeps the rest as stored. */
export type MySettingsChange = Partial<MySettings>;

const SETTINGS_PATH = "/api/users/me/settings";

export const putMySettings = (change: MySettingsChange) =>
  apiRequest<MySettings>(SETTINGS_PATH, { method: "PUT", body: change });

export function useMySettings({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.mySettings(),
    queryFn: ({ signal }) => apiRequest<MySettings>(SETTINGS_PATH, { signal }),
    enabled,
  });
}

/**
 * Settings save on change, with no Save button. `settings` shows a change while it is in flight
 * and drops it again if the server does not take it.
 */
export function useSaveMySettings(): {
  settings: MySettings | undefined;
  save: (change: MySettingsChange) => void;
} {
  const queryClient = useQueryClient();
  const writeFailure = useWriteFailure();
  const stored = useMySettings().data;

  const mutation = useMutation({
    mutationFn: putMySettings,
    onSuccess: (saved) => queryClient.setQueryData(qk.mySettings(), saved),
    onError: (error, change) =>
      writeFailure(error, { queryKeys: [qk.mySettings()], retry: () => mutation.mutate(change) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.mySettings() }),
  });

  const settings = stored && mutation.isPending ? { ...stored, ...mutation.variables } : stored;

  return { settings, save: mutation.mutate };
}
