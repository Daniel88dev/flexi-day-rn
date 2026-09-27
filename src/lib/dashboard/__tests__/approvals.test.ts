import type { PendingApproval } from "@/lib/query";

import { approvalKey } from "../approvals";

const ITEM: PendingApproval = {
  vacationIds: ["vacation-1", "vacation-2"],
  user: { id: "user-2", name: "Eva Horáková", initials: "EH", avatarColor: "hsl(20 60% 50%)" },
  groupId: "group-1",
  groupName: "Engineering",
  vacationType: "VACATION",
  from: "2026-10-05",
  to: "2026-10-06",
  businessDays: 2,
  note: null,
  submittedAt: "2026-09-20T08:00:00.000Z",
};

describe("approvalKey", () => {
  it("returns the item's first day", () => {
    expect(approvalKey(ITEM)).toBe("vacation-1");
  });

  it("returns the person and the first date for an item without days", () => {
    expect(approvalKey({ ...ITEM, vacationIds: [] })).toBe("user-2-2026-10-05");
  });
});
