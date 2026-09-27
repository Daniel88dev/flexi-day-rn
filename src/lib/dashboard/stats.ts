import type { DashboardSummary, DashboardSummaryRead } from "@/lib/query";

export type StatTileId = "pending" | "outToday" | "comingUp" | "workingToday";

export type StatTile = {
  id: StatTileId;
  value: number | "loading" | "unavailable";
  /** The web's panel links these two to the requests list. */
  linksToRequests: boolean;
};

type Count = keyof Omit<DashboardSummary, "teamSize">;

const TILES: { id: StatTileId; count: Count; linksToRequests: boolean }[] = [
  { id: "pending", count: "pendingApprovalsCount", linksToRequests: true },
  { id: "outToday", count: "outTodayCount", linksToRequests: false },
  { id: "comingUp", count: "upcomingNext14DaysCount", linksToRequests: true },
  { id: "workingToday", count: "workingTodayCount", linksToRequests: false },
];

/**
 * The web's stat strip: three tiles for everyone, and Pending first for a viewer who approves in
 * some group, at zero too. Every count is the server's, whatever the calendar's scope shows.
 */
export function statTiles(
  read: DashboardSummaryRead,
  { approver }: { approver: boolean }
): StatTile[] {
  return TILES.filter((tile) => approver || tile.id !== "pending").map(
    ({ id, count, linksToRequests }) => ({
      id,
      value:
        read.state === "ready"
          ? read.summary[count]
          : read.state === "loading"
            ? "loading"
            : "unavailable",
      linksToRequests,
    })
  );
}
