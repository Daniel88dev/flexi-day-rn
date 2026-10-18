import { en } from "@/i18n/en";
import { ApiError } from "@/lib/query/failure";

import { groupEventFailure } from "../failure";

describe("groupEventFailure", () => {
  it("returns the plan copy for a group that can't take new group events", () => {
    const refused = new ApiError(402, "Payment required", {
      reason: "PLAN_LIMIT",
      code: "GROUP_EVENTS_PLAN_REQUIRED",
    });
    expect(groupEventFailure(refused, en)).toBe(
      "This group isn't on a paid plan, so it can't take new group events."
    );
  });

  it("returns the server's message for any other answer", () => {
    expect(groupEventFailure(new ApiError(422, "A changed occurrence lasts one day"), en)).toBe(
      "A changed occurrence lasts one day"
    );
  });

  it("returns the unreachable copy when no answer came", () => {
    expect(groupEventFailure(new TypeError("Network request failed"), en)).toBe(
      en.sync.unreachable
    );
  });

  it("returns null when the session ended, which the shell answers", () => {
    expect(groupEventFailure(new ApiError(401, null), en)).toBeNull();
  });
});
