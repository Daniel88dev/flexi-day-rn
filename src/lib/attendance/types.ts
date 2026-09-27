import type { SelfServiceWindow } from "./self-service";

export type AttendanceBreak = {
  id: string;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  autoClosed: boolean;
  open: boolean;
};

export type AttendanceBreakSpan = { startedAt: string; endedAt: string };

export type AttendanceSession = {
  id: string;
  businessDate: string;
  startedAt: string;
  endedAt: string | null;
  timezone: string;
  closedBy: "USER" | "ADMIN" | "SWEEP" | null;
  /** Optional, as on the web: a backend older than this build sends none, and absent is clocked. */
  origin?: "CLOCKED" | "ENTERED";
  /** Who entered it; null for a clocked session. Optional for the same older backend. */
  enteredByUserId?: string | null;
  changedAfterDay?: boolean;
  open: boolean;
  /** Null covers declined, never asked and erased alike; the screens never tell them apart. */
  startLatitude: number | null;
  startLongitude: number | null;
  startAccuracy: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
  endAccuracy: number | null;
  breaks: AttendanceBreak[];
};

export type AttendanceState = {
  organizationId: string;
  employmentId: string;
  employmentEnded: boolean;
  active: boolean;
  locationEnabled: boolean;
  /** Optional, as a backend older than this build sends none; absent offers no self-service. */
  selfService?: SelfServiceWindow;
  /** The reader is an admin over their own Employment, so their writes clear the flag. */
  administersOwnAttendance?: boolean;
  timezone: string | null;
  businessDate: string | null;
  openSession: AttendanceSession | null;
  openBreak: AttendanceBreak | null;
  sessions: AttendanceSession[];
  autoClosedSession: AttendanceSession | null;
};

export type AttendanceDayRead = {
  organizationId: string;
  employmentId: string;
  businessDate: string;
  timezone: string | null;
  sessions: AttendanceSession[];
};

export type AttendanceExclusion = {
  cause: "NOT_EMPLOYED" | "NON_WORKING_DAY" | "HOLIDAY" | "ABSENCE";
  /** `HALF` halves the required time rather than taking the day. */
  extent: "FULL" | "HALF";
  label: string | null;
};

export type AttendanceMonthDay = {
  businessDate: string;
  presenceMinutes: number;
  breaksMinutes: number;
  deductedMinutes: number;
  workedMinutes: number;
  requiredMinutes: number;
  balanceMinutes: number | null;
  upcoming: boolean;
  open: boolean;
  autoClosed: boolean;
  exclusion: AttendanceExclusion | null;
  excludedClockIn: boolean;
  entered?: boolean;
  changedAfterDay?: boolean;
  flagged: boolean;
  sessions: AttendanceSession[];
};

export type AttendanceBalanceMode = "DAILY" | "MONTHLY";

export type AttendanceMonth = {
  organizationId: string;
  employmentId: string;
  timezone: string | null;
  businessDate: string | null;
  year: number;
  month: number;
  balanceMode: AttendanceBalanceMode;
  requiredMinutesPerDay: number;
  breakMinutes: number;
  breakThresholdMinutes: number;
  days: AttendanceMonthDay[];
  totals: {
    presenceMinutes: number;
    workedMinutes: number;
    requiredMinutes: number;
    requiredRangeMinutes: number;
    balanceMinutes: number;
    flaggedDays: number;
    excludedDays: number;
  };
};

/** The backend's `attendanceEventType` enum: every change a session's timeline records. */
export type AttendanceEventType =
  | "CLOCK_IN"
  | "CLOCK_OUT"
  | "BREAK_START"
  | "BREAK_END"
  | "LOCATION_UPDATED"
  | "SESSION_EDITED"
  | "BREAK_EDITED"
  | "BREAK_DELETED"
  | "SESSION_DELETED"
  | "SESSION_CREATED"
  | "BREAK_ADDED"
  | "SESSION_CHECKED";
