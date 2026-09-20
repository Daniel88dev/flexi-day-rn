import { nativeApplicationVersion, nativeBuildVersion } from "expo-application";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";

import { currentDeviceId } from "./device-id";

export const CLIENT_HEADER_NAMES = {
  deviceId: "x-client-device-id",
  sessionId: "x-client-session-id",
  platform: "x-client-platform",
  appVersion: "x-client-app-version",
} as const;

export type ClientIdentity = {
  deviceId: string;
  sessionId: string;
  platform: string;
  appVersion: string | null;
};

/**
 * The version the backend logs. It matches the value against a pattern that allows no spaces or
 * brackets and drops it whole otherwise, so the build number rides behind a plus.
 */
export function clientAppVersion(version: string | null, build: string | null): string | null {
  if (!version) return null;
  return build ? `${version}+${build}` : version;
}

export function clientHeaders(identity: ClientIdentity): Record<string, string> {
  return {
    [CLIENT_HEADER_NAMES.deviceId]: identity.deviceId,
    [CLIENT_HEADER_NAMES.sessionId]: identity.sessionId,
    [CLIENT_HEADER_NAMES.platform]: identity.platform,
    ...(identity.appVersion ? { [CLIENT_HEADER_NAMES.appVersion]: identity.appVersion } : {}),
  };
}

// One id per launch, in memory only: it groups a run's requests in the backend's log.
let launchSessionId: string | null = null;

function currentSessionId(): string {
  return (launchSessionId ??= randomUUID());
}

export function currentClientHeaders(): Record<string, string> {
  const deviceId = currentDeviceId();
  if (!deviceId) return {};

  return clientHeaders({
    deviceId,
    sessionId: currentSessionId(),
    platform: Platform.OS,
    appVersion: clientAppVersion(nativeApplicationVersion, nativeBuildVersion),
  });
}

export type HeaderSink = { set(name: string, value: string): void };

export function attachClientHeaders(headers: HeaderSink): void {
  for (const [name, value] of Object.entries(currentClientHeaders())) {
    headers.set(name, value);
  }
}
