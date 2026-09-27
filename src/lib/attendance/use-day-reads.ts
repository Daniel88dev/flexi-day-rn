import { useQuery } from "@tanstack/react-query";

import { apiRequest, qk } from "@/lib/query";

import { yearMonthOf } from "./day-reads";
import type { AttendanceDayRead, AttendanceMonth } from "./types";

/** One past business date's sessions. Today's come from the clock's `/current` instead. */
export function useDayRead(organizationId: string | null, businessDate: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.attendanceDay({ organizationId: organizationId ?? "", businessDate }),
    queryFn: ({ signal }) =>
      apiRequest<AttendanceDayRead>(
        `/api/attendance/day?${new URLSearchParams({
          organizationId: organizationId ?? "",
          businessDate,
        }).toString()}`,
        { signal }
      ),
    enabled: enabled && organizationId !== null,
  });
}

export function useMonthRead(organizationId: string | null, businessDate: string) {
  const { year, month } = yearMonthOf(businessDate);
  return useQuery({
    queryKey: qk.attendanceMonth(year, month, organizationId),
    queryFn: ({ signal }) =>
      apiRequest<AttendanceMonth>(
        `/api/attendance/month?${new URLSearchParams({
          year: String(year),
          month: String(month),
          organizationId: organizationId ?? "",
        }).toString()}`,
        { signal }
      ),
    enabled: organizationId !== null,
  });
}
