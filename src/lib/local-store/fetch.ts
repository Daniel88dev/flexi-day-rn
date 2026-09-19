/** As much of a response as the store reads, so the device passes `fetch` and Jest passes a fake. */
export type StoreResponse = {
  status: number;
  json(): Promise<unknown>;
};

/** The verbs the store's writes use; a pull sends none and gets the default. */
export type StoreRequestMethod = "POST" | "PATCH" | "DELETE";

export type StoreRequestInit = {
  signal: AbortSignal;
  method?: StoreRequestMethod;
  headers?: Record<string, string>;
  body?: string;
};

/** A fetch already bound to the API base URL: the pull and the writes only ever name a path. */
export type StoreFetch = (path: string, init: StoreRequestInit) => Promise<StoreResponse>;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The backend answers a failure as `{ errors: [{ message }] }`; the first one is the one. A body
 * its validator refused never reaches that middleware and says `{ error, details: [{ message }] }`.
 */
export async function serverMessage(response: StoreResponse): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      errors?: { message?: unknown }[];
      details?: { message?: unknown }[];
      message?: unknown;
      error?: unknown;
    } | null;
    return (
      nonEmptyString(body?.errors?.[0]?.message) ??
      nonEmptyString(body?.details?.[0]?.message) ??
      nonEmptyString(body?.message) ??
      nonEmptyString(body?.error)
    );
  } catch {
    return null;
  }
}
