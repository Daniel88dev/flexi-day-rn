import type { SyncEnvelope } from "../envelope";
import type { SyncFetch } from "../pull";

export type FakeSyncReply =
  | { type: "page"; page: SyncEnvelope }
  | { type: "status"; status: number; body: unknown }
  | { type: "failure"; error: Error }
  /** Answers only when the request is aborted, which is how the page timeout is exercised. */
  | { type: "hang" };

export const reply = {
  page: (page: SyncEnvelope): FakeSyncReply => ({ type: "page", page }),

  /** A failure in the backend's envelope: every error it answers is `{ errors: [{ message }] }`. */
  status: (status: number, message = `status ${status}`): FakeSyncReply => ({
    type: "status",
    status,
    body: { errors: [{ message }] },
  }),

  /** A failure whose body is something else, for the shapes the loop still has to survive. */
  statusWithBody: (status: number, body: unknown): FakeSyncReply => ({
    type: "status",
    status,
    body,
  }),

  failure: (message: string): FakeSyncReply => ({ type: "failure", error: new Error(message) }),
  hang: (): FakeSyncReply => ({ type: "hang" }),
};

export type FakeSync = {
  fetchPage: SyncFetch;
  /** The cursor each request carried, in order; `null` for a request that sent none. */
  cursors: (string | null)[];
};

/** A sync pull server of canned replies, one per request, that records the cursors it was sent. */
export function createFakeSync(
  replies: FakeSyncReply[],
  options: { onRequest?: (cursor: string | null) => void } = {}
): FakeSync {
  const queue = [...replies];
  const cursors: (string | null)[] = [];

  return {
    cursors,

    fetchPage(path, init) {
      const cursor = new URL(path, "http://sync.test").searchParams.get("cursor");
      cursors.push(cursor);
      options.onRequest?.(cursor);

      const next = queue.shift();
      if (!next) return Promise.reject(new Error(`No reply queued for ${path}.`));

      switch (next.type) {
        case "page":
          return Promise.resolve({ status: 200, json: () => Promise.resolve(next.page) });
        case "status":
          return Promise.resolve({ status: next.status, json: () => Promise.resolve(next.body) });
        case "failure":
          return Promise.reject(next.error);
        case "hang":
          return new Promise((_resolve, rejectRequest) => {
            init.signal.addEventListener("abort", () =>
              rejectRequest(new Error("The request was aborted."))
            );
          });
      }
    },
  };
}
