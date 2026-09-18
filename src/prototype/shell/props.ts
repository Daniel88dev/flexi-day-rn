import type { Role } from "@/prototype/shell/nav";

export type ShellState = "data" | "empty";

export type Viewer = { name: string; email: string; org: string; teamSize: number };

export type ShellProps = {
  viewer: Viewer;
  role: Role;
  state: ShellState;
  /** Minutes since the last sync pull, so each frame can show freshness its own way. */
  syncedMinutesAgo: number;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
};
