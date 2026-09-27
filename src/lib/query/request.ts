import { serverMessage, type ApiFetch } from "@/lib/api";

import { ApiError } from "./failure";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export type ApiRequest = <TResult>(path: string, options?: ApiRequestOptions) => Promise<TResult>;

const NO_CONTENT = 204;

/**
 * A JSON request through the app's one request wrapper. An answer outside 2xx throws an
 * `ApiError`; a request that got no answer throws whatever the fetch threw.
 */
export function createApiRequest(apiFetch: ApiFetch): ApiRequest {
  return async <TResult>(path: string, { method, body, signal }: ApiRequestOptions = {}) => {
    const response = await apiFetch(path, {
      method,
      signal,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(response.status, await serverMessage(response));
    }
    if (response.status === NO_CONTENT) return undefined as TResult;
    return (await response.json()) as TResult;
  };
}
