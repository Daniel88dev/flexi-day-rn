import type { AttendanceSession } from "./types";

export type SessionEnd = "IN" | "OUT";

function fixOf(session: AttendanceSession, end: SessionEnd) {
  return end === "IN"
    ? {
        latitude: session.startLatitude,
        longitude: session.startLongitude,
        accuracy: session.startAccuracy,
      }
    : {
        latitude: session.endLatitude,
        longitude: session.endLongitude,
        accuracy: session.endAccuracy,
      };
}

const located = (latitude: number | null, longitude: number | null) =>
  latitude !== null &&
  longitude !== null &&
  Number.isFinite(latitude) &&
  Number.isFinite(longitude);

/** Whether the location strip is worth a row: an organization that turned location off keeps what it took. */
export function anySessionLocated(sessions: AttendanceSession[]): boolean {
  return sessions.some((session) =>
    (["IN", "OUT"] as const).some((end) => {
      const fix = fixOf(session, end);
      return located(fix.latitude, fix.longitude);
    })
  );
}

/**
 * One end's fix as the web prints it: four decimals, about eleven metres, and the radius rounded
 * to the metre. Null coordinates read as "—" whatever the reason, declined or never asked.
 */
export function locationText(
  session: AttendanceSession,
  end: SessionEnd
): { coordinates: string | null; accuracy: number | null } {
  const { latitude, longitude, accuracy } = fixOf(session, end);
  if (latitude === null || longitude === null || !located(latitude, longitude)) {
    return { coordinates: null, accuracy: null };
  }
  const radius =
    accuracy !== null && Number.isFinite(accuracy) && accuracy > 0
      ? Math.max(1, Math.round(accuracy))
      : null;
  return { coordinates: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, accuracy: radius };
}
