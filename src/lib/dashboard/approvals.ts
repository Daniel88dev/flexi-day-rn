import type { PendingApproval } from "@/lib/query";

/** The web's key for an approvals item: its first day, or its person and start without one. */
export const approvalKey = (item: PendingApproval): string =>
  item.vacationIds[0] ?? `${item.user.id}-${item.from}`;
