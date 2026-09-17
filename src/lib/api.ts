import Constants from "expo-constants";

const API_PORT = 8080;

// An explicit URL wins. Without one, the backend is assumed to run on the machine serving Metro,
// so a phone on the LAN reaches the Mac without a .env file.
export function resolveApiUrl(envUrl: string | undefined, hostUri: string | undefined): string {
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const host = hostUri?.split(":")[0];
  return `http://${host || "localhost"}:${API_PORT}`;
}

export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri
);
