import Constants from "expo-constants";

const API_PORT = 8080;

const WEB_SITE_URL = "https://flexi-day.com";

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// An explicit URL wins. Without one, the backend is assumed to run on the machine serving Metro,
// so a phone on the LAN reaches the Mac without a .env file.
export function resolveApiUrl(envUrl: string | undefined, hostUri: string | undefined): string {
  if (envUrl) return withoutTrailingSlash(envUrl);
  const host = hostUri?.split(":")[0];
  return `http://${host || "localhost"}:${API_PORT}`;
}

export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri
);

export function resolveWebUrl(envUrl: string | undefined): string {
  return withoutTrailingSlash(envUrl || WEB_SITE_URL);
}

export const WEB_URL = resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL);

export type ApiRequestInit = {
  signal?: AbortSignal;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type ApiRequestConfig = ApiRequestInit & {
  headers: Record<string, string>;
  credentials: "omit";
};

export type ApiResponse = {
  status: number;
  json(): Promise<unknown>;
};

export type ApiFetch = (path: string, init?: ApiRequestInit) => Promise<ApiResponse>;

export type ApiFetchOptions = {
  baseUrl: string;
  clientHeaders: () => Record<string, string>;
  cookie: () => Promise<string>;
  onUnauthorized: () => void;
  fetchImpl?: (url: string, config: ApiRequestConfig) => Promise<ApiResponse>;
};

const UNAUTHORIZED = 401;

/**
 * The one request every `/api/*` call goes through: it names the backend, identifies the phone,
 * carries the session cookie and hands a 401 over. Nothing else in the app builds a request.
 */
export function createApiFetch({
  baseUrl,
  clientHeaders,
  cookie,
  onUnauthorized,
  fetchImpl = fetch,
}: ApiFetchOptions): ApiFetch {
  return async (path, init = {}) => {
    const jar = await cookie();

    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      // The client headers last: a caller cannot pass itself off as another phone.
      headers: { ...init.headers, ...(jar ? { Cookie: jar } : {}), ...clientHeaders() },
      // iOS keeps a cookie jar of its own; the auth client's is the only one that may answer.
      credentials: "omit",
    });

    if (response.status === UNAUTHORIZED) onUnauthorized();
    return response;
  };
}
