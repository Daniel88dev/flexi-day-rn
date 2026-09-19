/** As much of a response as the store reads, so the device passes `fetch` and Jest passes a fake. */
export type StoreResponse = {
  status: number;
  json(): Promise<unknown>;
};

export type StoreRequestInit = {
  signal: AbortSignal;
  method?: "POST";
  headers?: Record<string, string>;
  body?: string;
};

/** A fetch already bound to the API base URL: the pull and the writes only ever name a path. */
export type StoreFetch = (path: string, init: StoreRequestInit) => Promise<StoreResponse>;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** The backend answers every failure as `{ errors: [{ message }] }`; the first one is the one. */
export async function serverMessage(response: StoreResponse): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      errors?: { message?: unknown }[];
      message?: unknown;
    } | null;
    return nonEmptyString(body?.errors?.[0]?.message) ?? nonEmptyString(body?.message);
  } catch {
    return null;
  }
}
