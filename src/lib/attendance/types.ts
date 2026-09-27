export type AttendanceBreak = {
  id: string;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  autoClosed: boolean;
  open: boolean;
};

export type AttendanceSession = {
  id: string;
  businessDate: string;
  startedAt: string;
  endedAt: string | null;
  timezone: string;
  closedBy: "USER" | "ADMIN" | "SWEEP" | null;
  open: boolean;
  breaks: AttendanceBreak[];
};

export type AttendanceState = {
  organizationId: string;
  employmentId: string;
  employmentEnded: boolean;
  active: boolean;
  locationEnabled: boolean;
  timezone: string | null;
  businessDate: string | null;
  openSession: AttendanceSession | null;
  openBreak: AttendanceBreak | null;
  sessions: AttendanceSession[];
  autoClosedSession: AttendanceSession | null;
};
