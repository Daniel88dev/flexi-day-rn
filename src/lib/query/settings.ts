import { useQuery } from "@tanstack/react-query";

import { qk } from "./keys";
import { apiRequest } from "./runtime";

export type MySettings = {
  emailNotifications: boolean;
  dashboardScope: "MINE" | "GROUP";
  dashboardGroupId: string | null;
  dashboardCalendarView: "LANES" | "STRIPES";
  attendanceLocationNoticeDismissed: boolean;
};

export function useMySettings() {
  return useQuery({
    queryKey: qk.mySettings(),
    queryFn: ({ signal }) => apiRequest<MySettings>("/api/users/me/settings", { signal }),
  });
}
