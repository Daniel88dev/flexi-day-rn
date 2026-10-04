import type { CalendarRecordType } from "@/lib/local-store";

import { buildMemberRemaining, type MemberRemaining } from "./remaining";
import type { ReportOverview, ReportScopeGroup } from "./types";

export type PeopleSection = { group: ReportScopeGroup; rows: MemberRemaining[] };

/**
 * One section per group in the answer's order, each person's figures from that group's lines
 * only, and no section for a group with nobody in it.
 */
export function peopleSections(
  overview: ReportOverview,
  type: CalendarRecordType
): PeopleSection[] {
  return overview.groups
    .map((group) => ({
      group,
      rows: buildMemberRemaining(
        overview.members.filter((member) => member.groupId === group.groupId),
        overview.summary.filter((row) => row.groupId === group.groupId),
        type
      ),
    }))
    .filter((section) => section.rows.length > 0);
}
