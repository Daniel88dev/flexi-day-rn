import {
  devSignIn,
  devSignInTarget,
  setDevSignInLanding,
  takeDevSignInLanding,
  type DevSignInSteps,
} from "@/lib/session/dev-sign-in";

const USER = { id: "kXk2Q7pR9sT1vW3yZ5aB7cD9eF1gH3iJ" };

function steps(overrides: Partial<DevSignInSteps> = {}): DevSignInSteps {
  return {
    wipe: jest.fn().mockResolvedValue(undefined),
    redeem: jest.fn().mockResolvedValue({ data: { token: "a-token", user: USER }, error: null }),
    readSession: jest.fn().mockResolvedValue({ data: { user: USER }, error: null }),
    signedIn: jest.fn(),
    land: jest.fn(),
    ...overrides,
  };
}

describe("devSignInTarget", () => {
  it("returns an in-app path as given", () => {
    expect(devSignInTarget("/requests")).toBe("/requests");
    expect(devSignInTarget("/requests/abc?tab=files")).toBe("/requests/abc?tab=files");
  });

  it("returns the dashboard when there is no path", () => {
    expect(devSignInTarget(undefined)).toBe("/dashboard");
    expect(devSignInTarget("")).toBe("/dashboard");
    expect(devSignInTarget(["/requests", "/settings"])).toBe("/dashboard");
  });

  it("returns the dashboard for anything that could leave the app", () => {
    expect(devSignInTarget("https://example.com/requests")).toBe("/dashboard");
    expect(devSignInTarget("flexiday://requests")).toBe("/dashboard");
    expect(devSignInTarget("//example.com/requests")).toBe("/dashboard");
    expect(devSignInTarget("/\\example.com")).toBe("/dashboard");
    expect(devSignInTarget("requests")).toBe("/dashboard");
  });
});

describe("devSignIn", () => {
  it("returns null once it has wiped, redeemed, read the session back and landed", async () => {
    const run = steps();

    const failure = await devSignIn({ ticket: "a-ticket", to: "/requests" }, run);

    expect(failure).toBeNull();
    expect(run.redeem).toHaveBeenCalledWith("a-ticket");
    const order = [run.wipe, run.redeem, run.readSession, run.signedIn, run.land].map(
      (step) => (step as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(run.land).toHaveBeenCalledWith("/requests");
  });

  it("returns the server's refusal and stops before signing in", async () => {
    const run = steps({
      redeem: jest.fn().mockResolvedValue({
        data: null,
        error: { status: 401, code: "INVALID_SIGN_IN_TICKET", message: "Invalid sign-in ticket" },
      }),
    });

    const failure = await devSignIn({ ticket: "a-ticket", to: "/requests" }, run);

    expect(failure).toBe("INVALID_SIGN_IN_TICKET: Invalid sign-in ticket");
    expect(run.wipe).toHaveBeenCalledTimes(1);
    expect(run.readSession).not.toHaveBeenCalled();
    expect(run.signedIn).not.toHaveBeenCalled();
    expect(run.land).not.toHaveBeenCalled();
  });

  it("returns the status when the refusal carries no message", async () => {
    const run = steps({
      redeem: jest.fn().mockResolvedValue({ data: null, error: { status: 404 } }),
    });

    expect(await devSignIn({ ticket: "a-ticket" }, run)).toBe("HTTP 404");
  });

  it("returns null and lands on the dashboard itself when the link names no path", async () => {
    const run = steps();

    expect(await devSignIn({ ticket: "a-ticket" }, run)).toBeNull();
    expect(run.land).toHaveBeenCalledWith(null);
  });

  it("returns a failure and wipes the redeemed cookie when the session does not read back", async () => {
    const run = steps({ readSession: jest.fn().mockResolvedValue({ data: null, error: null }) });

    expect(await devSignIn({ ticket: "a-ticket" }, run)).toMatch(/no session/);
    expect(run.wipe).toHaveBeenCalledTimes(2);
    expect(run.signedIn).not.toHaveBeenCalled();
  });

  it("returns the cause and wipes again when the session read throws", async () => {
    const run = steps({
      readSession: jest.fn().mockRejectedValue(new TypeError("Network failed")),
    });

    expect(await devSignIn({ ticket: "a-ticket" }, run)).toBe("Network failed");
    expect(run.wipe).toHaveBeenCalledTimes(2);
  });

  it("returns the cause when the request never reaches the server", async () => {
    const run = steps({ redeem: jest.fn().mockRejectedValue(new TypeError("Network failed")) });

    expect(await devSignIn({ ticket: "a-ticket" }, run)).toBe("Network failed");
    expect(run.wipe).toHaveBeenCalledTimes(1);
    expect(run.signedIn).not.toHaveBeenCalled();
  });

  it("returns a failure without touching the phone when the link has no ticket", async () => {
    const run = steps();

    expect(await devSignIn({ ticket: undefined }, run)).toMatch(/no ticket/);
    expect(run.wipe).not.toHaveBeenCalled();
    expect(run.redeem).not.toHaveBeenCalled();
  });
});

describe("takeDevSignInLanding", () => {
  it("returns the landing once, then nothing", () => {
    setDevSignInLanding("/settings");

    expect(takeDevSignInLanding()).toBe("/settings");
    expect(takeDevSignInLanding()).toBeNull();
  });
});
