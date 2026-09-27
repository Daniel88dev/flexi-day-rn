import type { WriteOutcome } from "@/lib/local-store";

/** An answer outside 2xx, carrying what the server said about it. */
export class ApiError extends Error {
  readonly status: number;
  readonly serverMessage: string | null;
  /** What the server made public about it, where a refusal names its `reason`. */
  readonly context?: Record<string, unknown>;

  constructor(status: number, serverMessage: string | null, context?: Record<string, unknown>) {
    super(serverMessage ?? `The server answered ${status}.`);
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
    this.context = context;
  }
}

/**
 * How a screen answers a failed write. A refusal means the screen acted on a stale answer; a
 * failure is a request the server will not take as sent. Neither turns out differently on a second
 * try. A retryable failure carries no message when no answer arrived at all.
 */
export type FailureClass =
  | { kind: "refusal"; message: string | null }
  | { kind: "failed"; message: string | null }
  | { kind: "retryable"; message: string | null }
  | { kind: "signed-out" };

const UNAUTHORIZED = 401;
const REFUSALS = new Set([402, 403, 409]);

type FailedWrite = Extract<WriteOutcome, { ok: false }>;

function isFailedWrite(failure: unknown): failure is FailedWrite {
  return typeof failure === "object" && failure !== null && "ok" in failure && !failure.ok;
}

function answerOf(failure: unknown): { status: number; message: string | null } | null {
  if (failure instanceof ApiError)
    return { status: failure.status, message: failure.serverMessage };
  if (isFailedWrite(failure) && failure.reason === "rejected") {
    return { status: failure.status, message: failure.message };
  }
  return null;
}

export function classifyFailure(failure: unknown): FailureClass {
  const answer = answerOf(failure);
  if (!answer) return { kind: "retryable", message: null };
  if (answer.status === UNAUTHORIZED) return { kind: "signed-out" };
  if (REFUSALS.has(answer.status)) return { kind: "refusal", message: answer.message };
  if (answer.status < 500) return { kind: "failed", message: answer.message };
  return { kind: "retryable", message: answer.message };
}
