import {
  defaultTwoFactorMethod,
  isChallengeDead,
  parseTwoFactorMethods,
  twoFactorErrorKey,
} from "@/lib/session/two-factor";

describe("parseTwoFactorMethods", () => {
  it("splits the comma list from the sign-in response", () => {
    expect(parseTwoFactorMethods("totp,otp")).toEqual(["totp", "otp"]);
  });

  it("returns an empty list for a missing or empty param", () => {
    expect(parseTwoFactorMethods(null)).toEqual([]);
    expect(parseTwoFactorMethods("")).toEqual([]);
  });

  it("drops blanks and trims entries", () => {
    expect(parseTwoFactorMethods(" totp , ,otp,")).toEqual(["totp", "otp"]);
  });
});

describe("defaultTwoFactorMethod", () => {
  it("prefers the authenticator app when linked", () => {
    expect(defaultTwoFactorMethod(["totp", "otp"])).toBe("totp");
  });

  it("falls back to email for an email-only enrollee", () => {
    expect(defaultTwoFactorMethod(["otp"])).toBe("otp");
    expect(defaultTwoFactorMethod([])).toBe("otp");
  });
});

describe("twoFactorErrorKey", () => {
  it("maps the plugin's error codes", () => {
    expect(twoFactorErrorKey(401, "INVALID_CODE")).toBe("invalidCode");
    expect(twoFactorErrorKey(401, "INVALID_BACKUP_CODE")).toBe("invalidCode");
    expect(twoFactorErrorKey(400, "OTP_HAS_EXPIRED")).toBe("expiredOtp");
    expect(twoFactorErrorKey(400, "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE")).toBe("tooManyAttempts");
    expect(twoFactorErrorKey(401, "INVALID_TWO_FACTOR_COOKIE")).toBe("challengeExpired");
    expect(twoFactorErrorKey(429, "ACCOUNT_TEMPORARILY_LOCKED")).toBe("locked");
  });

  it("treats a codeless 429 as rate limiting", () => {
    expect(twoFactorErrorKey(429, undefined)).toBe("rateLimited");
  });

  it("falls back to generic for anything else", () => {
    expect(twoFactorErrorKey(500, undefined)).toBe("generic");
    expect(twoFactorErrorKey(undefined, "SOMETHING_ELSE")).toBe("generic");
  });
});

describe("isChallengeDead", () => {
  it("marks the challenge dead when only a fresh sign-in can help", () => {
    expect(isChallengeDead("challengeExpired", "totp")).toBe(true);
    expect(isChallengeDead("challengeExpired", "otp")).toBe(true);
    expect(isChallengeDead("tooManyAttempts", "totp")).toBe(true);
    expect(isChallengeDead("tooManyAttempts", "backup")).toBe(true);
  });

  it("keeps the emailed-code path alive on attempt exhaustion — a resend recovers", () => {
    // verify-otp's budget lives on the code, not the challenge cookie.
    expect(isChallengeDead("tooManyAttempts", "otp")).toBe(false);
  });

  it("keeps retryable errors alive", () => {
    expect(isChallengeDead("invalidCode", "totp")).toBe(false);
    expect(isChallengeDead("expiredOtp", "otp")).toBe(false);
    expect(isChallengeDead("rateLimited", "backup")).toBe(false);
  });
});
