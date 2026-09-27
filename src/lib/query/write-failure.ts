import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { Dictionary } from "@/i18n";
import type { PullOutcome, PullReason } from "@/lib/local-store";

import { classifyFailure, type FailureClass } from "./failure";

export type FailureToast = {
  error(message: string, options?: { action: { label: string; onClick: () => void } }): void;
};

export type WriteFailureDeps = {
  queryClient: QueryClient;
  toast: FailureToast;
  pull: (reason: PullReason) => Promise<PullOutcome>;
  t: Dictionary;
};

export type WriteFailureOptions = {
  /** What the screen shows; a refusal reads it again. */
  queryKeys: readonly QueryKey[];
  retry: () => void;
};

export type WriteFailureHandler = (failure: unknown, options: WriteFailureOptions) => FailureClass;

export function createWriteFailureHandler({
  queryClient,
  toast,
  pull,
  t,
}: WriteFailureDeps): WriteFailureHandler {
  return (failure, { queryKeys, retry }) => {
    const failureClass = classifyFailure(failure);

    if (failureClass.kind === "refusal") {
      toast.error(failureClass.message ?? t.request.refused);
      for (const queryKey of queryKeys) void queryClient.invalidateQueries({ queryKey });
      void pull("refresh").catch(() => undefined);
    } else if (failureClass.kind === "failed") {
      toast.error(failureClass.message ?? t.request.failed);
    } else if (failureClass.kind === "retryable") {
      toast.error(failureClass.message ?? t.sync.unreachable, {
        action: { label: t.request.retry, onClick: retry },
      });
    }

    return failureClass;
  };
}
