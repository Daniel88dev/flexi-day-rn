import type { Dictionary } from "@/i18n/en";
import { ApiError, classifyFailure } from "@/lib/query/failure";

const PLAN_REQUIRED = "GROUP_EVENTS_PLAN_REQUIRED";

/** A failed group event write in words, for the editor to show where the person is looking. */
export function groupEventFailure(error: unknown, t: Dictionary): string | null {
  if (error instanceof ApiError && error.context?.code === PLAN_REQUIRED) {
    return t.groupEvents.editor.planRequired;
  }
  const failure = classifyFailure(error);
  switch (failure.kind) {
    case "signed-out":
      return null;
    case "refusal":
      return failure.message ?? t.request.refused;
    case "failed":
      return failure.message ?? t.request.failed;
    case "retryable":
      return failure.message ?? t.sync.unreachable;
  }
}
