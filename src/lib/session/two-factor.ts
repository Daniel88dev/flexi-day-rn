export type TwoFactorMethod = "totp" | "otp" | "backup";

/** Second factors the server offered in the sign-in response's `twoFactorMethods`. */
export function parseTwoFactorMethods(param: string | null): string[] {
  return (param ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * TOTP first when the user linked an authenticator — it works offline and
 * costs nothing; email is the fallback. Backup codes are never a default.
 */
export function defaultTwoFactorMethod(methods: string[]): TwoFactorMethod {
  return methods.includes("totp") ? "totp" : "otp";
}

export type TwoFactorErrorKey =
  | "invalidCode"
  | "expiredOtp"
  | "tooManyAttempts"
  | "challengeExpired"
  | "locked"
  | "rateLimited"
  | "generic";

/**
 * Maps better-auth twoFactor error responses to dictionary keys. `code` is
 * the plugin's UPPER_SNAKE error code; the 429 has no code (it comes from the
 * rate limiter, not the plugin).
 */
export function twoFactorErrorKey(
  status: number | undefined,
  code: string | undefined | null
): TwoFactorErrorKey {
  switch (code) {
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return "invalidCode";
    case "OTP_HAS_EXPIRED":
      return "expiredOtp";
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "tooManyAttempts";
    case "INVALID_TWO_FACTOR_COOKIE":
      return "challengeExpired";
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "locked";
  }
  if (status === 429) return "rateLimited";
  return "generic";
}

/**
 * The challenge is dead — only a fresh sign-in can help. Attempt exhaustion
 * kills the challenge cookie for TOTP and backup codes, but for the emailed
 * code it only spends the current code's counter — a resend mints a fresh
 * one, so the screen must keep the resend path alive.
 */
export function isChallengeDead(key: TwoFactorErrorKey, method: TwoFactorMethod): boolean {
  if (key === "challengeExpired") return true;
  return key === "tooManyAttempts" && method !== "otp";
}
