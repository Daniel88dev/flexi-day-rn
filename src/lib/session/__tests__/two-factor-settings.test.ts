import {
  groupSecret,
  initialFlowState,
  isTwoFactorFlow,
  nextFlowState,
  swapsSession,
  totpSecret,
  twoFactorEnabled,
  twoFactorSettingsRefusal,
  type FlowState,
} from "../two-factor-settings";

const URI =
  "otpauth://totp/Flexi%20Day:dana%40northwind.co?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Flexi+Day&digits=6&period=30";

describe("twoFactorEnabled", () => {
  it("returns true only for a user whose flag is on", () => {
    expect(twoFactorEnabled({ twoFactorEnabled: true })).toBe(true);
    expect(twoFactorEnabled({ twoFactorEnabled: false })).toBe(false);
    expect(twoFactorEnabled({ twoFactorEnabled: null })).toBe(false);
    expect(twoFactorEnabled({})).toBe(false);
    expect(twoFactorEnabled(undefined)).toBe(false);
  });
});

describe("isTwoFactorFlow", () => {
  it("returns true for the four flows and false for anything else", () => {
    for (const flow of ["enable", "authenticator", "backupCodes", "disable"]) {
      expect(isTwoFactorFlow(flow)).toBe(true);
    }
    expect(isTwoFactorFlow("verify")).toBe(false);
    expect(isTwoFactorFlow(undefined)).toBe(false);
  });
});

describe("totpSecret", () => {
  it("returns the secret an otpauth link carries", () => {
    expect(totpSecret(URI)).toBe("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");
  });

  it("returns the secret wherever it sits in the query", () => {
    expect(totpSecret("otpauth://totp/x?issuer=Flexi+Day&secret=abc%3D")).toBe("abc=");
  });

  it("returns null for a link without one", () => {
    expect(totpSecret("otpauth://totp/x?issuer=Flexi")).toBeNull();
    expect(totpSecret("")).toBeNull();
  });
});

describe("groupSecret", () => {
  it("returns the secret in groups of four so it can be typed by hand", () => {
    expect(groupSecret("JBSWY3DPEHPK3PXPJB")).toBe("JBSW Y3DP EHPK 3PXP JB");
  });

  it("returns an empty string for an empty secret", () => {
    expect(groupSecret("")).toBe("");
  });
});

describe("nextFlowState", () => {
  const codes = ["aaaaa-bbbbb", "ccccc-ddddd"];

  it("returns backup codes, the method choice, then a code step for enable", () => {
    let state: FlowState = initialFlowState("enable");
    expect(state.step).toBe("password");

    state = nextFlowState(state, { type: "passwordAccepted", backupCodes: codes, totpURI: URI });
    expect(state).toMatchObject({ step: "backupCodes", backupCodes: codes, totpURI: URI });

    state = nextFlowState(state, { type: "codesSaved" });
    expect(state.step).toBe("method");

    expect(nextFlowState(state, { type: "authenticatorChosen" }).step).toBe("authenticator");
    state = nextFlowState(state, { type: "emailCodeSent" });
    expect(state.step).toBe("emailCode");

    expect(nextFlowState(state, { type: "verified" }).step).toBe("done");
  });

  it("returns the authenticator step straight after the password to set one up", () => {
    const state = nextFlowState(initialFlowState("authenticator"), {
      type: "passwordAccepted",
      totpURI: URI,
    });

    expect(state).toMatchObject({ step: "authenticator", totpURI: URI });
    expect(nextFlowState(state, { type: "verified" }).step).toBe("done");
  });

  it("returns the fresh codes as the last step of new backup codes", () => {
    const state = nextFlowState(initialFlowState("backupCodes"), {
      type: "passwordAccepted",
      backupCodes: codes,
    });

    expect(state).toMatchObject({ step: "backupCodes", backupCodes: codes });
    // Saving them closes the sheet; there is no step after them.
    expect(nextFlowState(state, { type: "codesSaved" })).toBe(state);
  });

  it("returns done once the password turns two-factor off", () => {
    expect(nextFlowState(initialFlowState("disable"), { type: "passwordAccepted" }).step).toBe(
      "done"
    );
  });

  it("returns the state unchanged for an event its step does not take", () => {
    const start = initialFlowState("enable");

    expect(nextFlowState(start, { type: "verified" })).toBe(start);
    expect(nextFlowState(start, { type: "codesSaved" })).toBe(start);
    expect(nextFlowState(initialFlowState("disable"), { type: "emailCodeSent" }).step).toBe(
      "password"
    );
  });
});

describe("swapsSession", () => {
  it("returns true for the calls better-auth answers with a new session", () => {
    const method = nextFlowState(
      nextFlowState(initialFlowState("enable"), {
        type: "passwordAccepted",
        backupCodes: [],
        totpURI: URI,
      }),
      { type: "codesSaved" }
    );
    expect(swapsSession(nextFlowState(method, { type: "authenticatorChosen" }))).toBe(true);
    expect(swapsSession(nextFlowState(method, { type: "emailCodeSent" }))).toBe(true);
    expect(swapsSession(initialFlowState("disable"))).toBe(true);
  });

  it("returns false for the calls that leave the session alone", () => {
    expect(swapsSession(initialFlowState("enable"))).toBe(false);
    expect(swapsSession(initialFlowState("backupCodes"))).toBe(false);
    // Two-factor is already on, so linking an authenticator flips nothing.
    expect(
      swapsSession(
        nextFlowState(initialFlowState("authenticator"), { type: "passwordAccepted", totpURI: URI })
      )
    ).toBe(false);
  });
});

describe("twoFactorSettingsRefusal", () => {
  it("returns wrongPassword for a refused password", () => {
    expect(
      twoFactorSettingsRefusal("password", {
        status: 400,
        code: "INVALID_PASSWORD",
        message: "Invalid password",
      })
    ).toEqual({ field: "password", key: "wrongPassword" });
  });

  it("returns the server's message for any other refusal of the password step", () => {
    expect(
      twoFactorSettingsRefusal("password", { status: 400, code: "X", message: "Nope" })
    ).toEqual({ field: "form", key: "server", message: "Nope" });
    expect(twoFactorSettingsRefusal("password", { status: 500 })).toEqual({
      field: "form",
      key: "actionFailed",
    });
  });

  it("returns rateLimited for a 429 at any step", () => {
    expect(twoFactorSettingsRefusal("password", { status: 429 })).toEqual({
      field: "form",
      key: "rateLimited",
    });
    expect(twoFactorSettingsRefusal("code", { status: 429 })).toEqual({
      field: "code",
      key: "rateLimited",
    });
  });

  it("returns the sign-in screen's keys for a refused code", () => {
    expect(twoFactorSettingsRefusal("code", { status: 401, code: "INVALID_CODE" })).toEqual({
      field: "code",
      key: "invalidCode",
    });
    expect(twoFactorSettingsRefusal("code", { status: 400, code: "OTP_HAS_EXPIRED" })).toEqual({
      field: "code",
      key: "expiredOtp",
    });
  });

  it("returns tooManyAttempts for spent attempts, which a new code fixes in Settings", () => {
    expect(
      twoFactorSettingsRefusal("code", {
        status: 400,
        code: "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
      })
    ).toEqual({ field: "code", key: "tooManyAttempts" });
  });

  it("returns session for a 401 from a password or send step", () => {
    expect(twoFactorSettingsRefusal("password", { status: 401, message: "Unauthorized" })).toEqual({
      field: "session",
    });
    expect(twoFactorSettingsRefusal("send", { status: 401 })).toEqual({ field: "session" });
  });

  it("returns session for a code check that found no session, and a refusal for a wrong code", () => {
    expect(
      twoFactorSettingsRefusal("code", { status: 401, code: "INVALID_TWO_FACTOR_COOKIE" })
    ).toEqual({ field: "session" });
    expect(twoFactorSettingsRefusal("code", { status: 401, code: "INVALID_CODE" })).toEqual({
      field: "code",
      key: "invalidCode",
    });
  });

  it("returns sendFailed for an email code that could not be sent", () => {
    expect(twoFactorSettingsRefusal("send", { status: 500 })).toEqual({
      field: "form",
      key: "sendFailed",
    });
  });
});
