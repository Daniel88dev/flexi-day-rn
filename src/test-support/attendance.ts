import type { AttendanceBreak, AttendanceSession, AttendanceState } from "@/lib/attendance/types";

export function session(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: "s1",
    businessDate: "2026-09-27",
    startedAt: "2026-09-27T06:00:00.000Z",
    endedAt: null,
    timezone: "Europe/Prague",
    closedBy: null,
    open: true,
    breaks: [],
    ...overrides,
  };
}

export function pause(overrides: Partial<AttendanceBreak> = {}): AttendanceBreak {
  return {
    id: "b1",
    sessionId: "s1",
    startedAt: "2026-09-27T08:00:00.000Z",
    endedAt: null,
    autoClosed: false,
    open: true,
    ...overrides,
  };
}

export function attendance(overrides: Partial<AttendanceState> = {}): AttendanceState {
  return {
    organizationId: "org-1",
    employmentId: "emp-1",
    employmentEnded: false,
    active: true,
    locationEnabled: false,
    timezone: "Europe/Prague",
    businessDate: "2026-09-27",
    openSession: null,
    openBreak: null,
    sessions: [],
    autoClosedSession: null,
    ...overrides,
  };
}
