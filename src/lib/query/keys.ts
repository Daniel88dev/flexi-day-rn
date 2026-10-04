/**
 * The web's query keys (`flexi-day/lib/api/queries.ts`), word for word, so a prefix invalidates
 * the same reads on both clients. An organization left out reads as "own", as on the web.
 */
export const qk = {
  vacation: (id: string) => ["vacation", id] as const,
  /** Every request detail: the prefix the web invalidates after a decision. */
  vacationDetails: () => ["vacation"] as const,
  group: (groupId: string) => ["group", groupId] as const,
  groupUsers: (groupId: string) => ["group-users", groupId] as const,
  quotas: (groupId: string, year: number, userId?: string) =>
    ["quotas", groupId, year, userId ?? "all"] as const,
  bankHolidayCountries: () => ["bank-holiday-countries"] as const,
  myApprovals: () => ["my-approvals"] as const,
  dashboardSummary: () => ["dashboard-summary"] as const,
  notifications: (unreadOnly: boolean) => ["notifications", unreadOnly] as const,
  allNotifications: () => ["notifications"] as const,
  mySettings: () => ["my-settings"] as const,
  /** The web keeps this one in `lib/auth/use-linked-accounts.ts`, outside its `qk`. */
  authAccounts: () => ["auth", "accounts"] as const,
  /** Not on the web yet: its Delete account card (T-128) should read under the same key. */
  accountDeletion: () => ["account-deletion"] as const,
  attendanceState: (organizationId?: string | null) =>
    ["attendance-state", organizationId ?? "own"] as const,
  attendanceMonth: (year: number, month: number, organizationId?: string | null) =>
    ["attendance-month", year, month, organizationId ?? "own"] as const,
  attendanceDay: (params: { organizationId: string; businessDate: string; userId?: string }) =>
    ["attendance-day", params.organizationId, params.businessDate, params.userId ?? "own"] as const,
  /** Every session's events: the prefix a self-service write invalidates. */
  attendanceEventsAll: () => ["attendance-events"] as const,
  attendanceEvents: (sessionId: string) => ["attendance-events", sessionId] as const,
};
