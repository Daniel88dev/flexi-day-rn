import type { SyncEnvelope } from "../envelope";
import type { SyncFetch } from "../pull";

export type FakeSyncReply =
  | { type: "page"; page: SyncEnvelope }
  | { type: "status"; status: number }
  | { type: "failure"; error: Error }
  /** Answers only when the request is aborted, which is how the page timeout is exercised. */
  | { type: "hang" };

export const reply = {
  page: (page: SyncEnvelope): FakeSyncReply => ({ type: "page", page }),
  status: (status: number): FakeSyncReply => ({ type: "status", status }),
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
          return Promise.resolve({
            status: next.status,
            json: () => Promise.resolve({ message: `status ${next.status}` }),
          });
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
