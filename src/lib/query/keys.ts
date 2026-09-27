/**
 * The web's query keys (`flexi-day/lib/api/queries.ts`), word for word, so a prefix invalidates
 * the same reads on both clients. An organization left out reads as "own", as on the web.
 */
export const qk = {
  vacation: (id: string) => ["vacation", id] as const,
  /** Every request detail: the prefix the web invalidates after a decision. */
  vacationDetails: () => ["vacation"] as const,
  group: (groupId: string) => ["group", groupId] as const,
  myApprovals: () => ["my-approvals"] as const,
  notifications: (unreadOnly: boolean) => ["notifications", unreadOnly] as const,
  mySettings: () => ["my-settings"] as const,
  attendanceState: (organizationId?: string | null) =>
    ["attendance-state", organizationId ?? "own"] as const,
  attendanceMonth: (year: number, month: number, organizationId?: string | null) =>
    ["attendance-month", year, month, organizationId ?? "own"] as const,
  attendanceDay: (params: { organizationId: string; businessDate: string; userId?: string }) =>
    ["attendance-day", params.organizationId, params.businessDate, params.userId ?? "own"] as const,
};
