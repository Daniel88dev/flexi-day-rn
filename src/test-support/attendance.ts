import type {
  AttendanceBreak,
  AttendanceMonth,
  AttendanceMonthDay,
  AttendanceSession,
  AttendanceState,
} from "@/lib/attendance/types";

export function session(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return {
    id: "s1",
    businessDate: "2026-09-27",
    startedAt: "2026-09-27T06:00:00.000Z",
    endedAt: null,
    timezone: "Europe/Prague",
    closedBy: null,
    origin: "CLOCKED",
    changedAfterDay: false,
    open: true,
    startLatitude: null,
    startLongitude: null,
    startAccuracy: null,
    endLatitude: null,
    endLongitude: null,
    endAccuracy: null,
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

export function monthDay(overrides: Partial<AttendanceMonthDay> = {}): AttendanceMonthDay {
  return {
    businessDate: "2026-09-21",
    presenceMinutes: 344,
    breaksMinutes: 30,
    deductedMinutes: 30,
    workedMinutes: 314,
    requiredMinutes: 480,
    balanceMinutes: -166,
    upcoming: false,
    open: false,
    autoClosed: false,
    exclusion: null,
    excludedClockIn: false,
    entered: false,
    changedAfterDay: false,
    flagged: false,
    sessions: [],
    ...overrides,
  };
}

/** A month whose every day is an ordinary one, until overridden by date. */
export function attendanceMonth(
  year: number,
  month: number,
  overrides: Partial<AttendanceMonth> = {},
  days: Record<string, Partial<AttendanceMonthDay>> = {}
): AttendanceMonth {
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    organizationId: "org-1",
    employmentId: "emp-1",
    timezone: "Europe/Prague",
    businessDate: "2026-09-27",
    year,
    month,
    balanceMode: "DAILY",
    requiredMinutesPerDay: 480,
    days: Array.from({ length }, (_, index) => {
      const businessDate = `${year}-${pad(month)}-${pad(index + 1)}`;
      return monthDay({ businessDate, ...days[businessDate] });
    }),
    totals: {
      presenceMinutes: 0,
      workedMinutes: 0,
      requiredMinutes: 0,
      requiredRangeMinutes: 0,
      balanceMinutes: 0,
      flaggedDays: 0,
      excludedDays: 0,
    },
    ...overrides,
  };
}
