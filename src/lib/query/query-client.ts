import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./failure";

const MAX_RETRIES = 1;

/** No 4xx turns out differently on a second try; a network fault or a 5xx gets one more. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * Memory only: nothing persists it, so a cold start reads everything again. Reads and writes run
 * offline too, so they fail at once and the screen offers a Retry instead of waiting paused; the
 * online manager still refetches on reconnect. Every foreground reads again, however fresh.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetryQuery,
        networkMode: "always",
        // TanStack turns reconnect refetches off by default under networkMode "always".
        refetchOnReconnect: true,
        refetchOnWindowFocus: "always",
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}
