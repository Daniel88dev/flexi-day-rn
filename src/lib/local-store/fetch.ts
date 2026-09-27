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
