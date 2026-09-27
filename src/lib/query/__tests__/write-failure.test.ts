import { QueryClient } from "@tanstack/react-query";

import { en } from "@/i18n/en";
import { ApiError } from "@/lib/query/failure";
import { createWriteFailureHandler, type FailureToast } from "@/lib/query/write-failure";

const STATE_KEY = ["attendance-state", "own"] as const;
const MONTH_KEY = ["attendance-month", 2026, 9, "own"] as const;
const OTHER_KEY = ["my-settings"] as const;

let client: QueryClient;
let toast: jest.Mocked<FailureToast>;
let pull: jest.Mock;
let retry: jest.Mock;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  for (const key of [STATE_KEY, MONTH_KEY, OTHER_KEY]) client.setQueryData(key, {});
  toast = { error: jest.fn() };
  pull = jest.fn().mockResolvedValue({ ok: true });
  retry = jest.fn();
});

afterEach(() => client.clear());

function handle(failure: unknown) {
  const onFailure = createWriteFailureHandler({ queryClient: client, toast, pull, t: en });
  return onFailure(failure, { queryKeys: [STATE_KEY, MONTH_KEY], retry });
}

const invalidated = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

describe("createWriteFailureHandler", () => {
  it("shows the server's words on a refusal, with no Retry", () => {
    handle(new ApiError(409, "You are already clocked in"));

    expect(toast.error).toHaveBeenCalledWith("You are already clocked in");
  });

  it("reloads the screen's queries and nothing else on a refusal", () => {
    handle(new ApiError(403, "Not allowed"));

    expect(invalidated(STATE_KEY)).toBe(true);
    expect(invalidated(MONTH_KEY)).toBe(true);
    expect(invalidated(OTHER_KEY)).toBe(false);
  });

  it("starts a sync pull on a refusal, so the Local store catches up too", () => {
    handle(new ApiError(402, "Your plan no longer covers attendance"));

    expect(pull).toHaveBeenCalledWith("refresh");
  });

  it("falls back on its own words when the refusal carried none", () => {
    handle(new ApiError(409, null));

    expect(toast.error).toHaveBeenCalledWith(en.request.refused);
  });

  it("offers a Retry that runs the write again when the server could not be reached", () => {
    handle(new TypeError("Network request failed"));

    expect(toast.error).toHaveBeenCalledWith(en.sync.unreachable, {
      action: { label: en.request.retry, onClick: expect.any(Function) },
    });
    toast.error.mock.calls[0][1]?.action.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(pull).not.toHaveBeenCalled();
    expect(invalidated(STATE_KEY)).toBe(false);
  });

  it("offers a Retry beside the server's words for a failure of the server's own", () => {
    handle(new ApiError(500, "Failed to clock in"));

    expect(toast.error).toHaveBeenCalledWith("Failed to clock in", {
      action: { label: en.request.retry, onClick: expect.any(Function) },
    });
  });

  it("shows the server's words for a request it could not take, with no Retry, reload or pull", () => {
    handle(new ApiError(422, "Selected day is not a working day"));

    expect(toast.error).toHaveBeenCalledWith("Selected day is not a working day");
    expect(invalidated(STATE_KEY)).toBe(false);
    expect(pull).not.toHaveBeenCalled();
  });

  it("falls back on its own words when a request it could not take carried none", () => {
    handle(new ApiError(404, null));

    expect(toast.error).toHaveBeenCalledWith(en.request.failed);
  });

  it("says nothing on a 401, which the Signed-out wipe answers", () => {
    handle(new ApiError(401, "Unauthorized"));

    expect(toast.error).not.toHaveBeenCalled();
    expect(pull).not.toHaveBeenCalled();
  });

  it("returns the class it acted on, for a screen that does more than toast", () => {
    expect(handle(new ApiError(403, "Not allowed"))).toEqual({
      kind: "refusal",
      message: "Not allowed",
    });
  });
});
