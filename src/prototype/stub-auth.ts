// PROTOTYPE. Fake auth so the screens can be driven without a backend. Magic inputs:
// password "wrong" fails; an email containing "2fa" needs a second factor ("totp" in the email
// offers the authenticator too); codes 000000 / 111111 / 222222 / 333333 / 444444 map to the
// invalid / too-many / expired-challenge / locked / expired-otp errors.
export type TwoFactorMethod = "totp" | "otp" | "backup";

export type TwoFactorErrorKey =
  | "invalidCode"
  | "expiredOtp"
  | "tooManyAttempts"
  | "challengeExpired"
  | "locked"
  | "rateLimited"
  | "generic";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type SignInResult =
  { ok: true } | { twoFactorRedirect: true; methods: TwoFactorMethod[] } | { error: "invalid" };

export async function stubSignIn(email: string, password: string): Promise<SignInResult> {
  await wait(1200);
  if (password === "wrong") return { error: "invalid" };
  if (email.includes("2fa")) {
    return { twoFactorRedirect: true, methods: email.includes("totp") ? ["totp", "otp"] : ["otp"] };
  }
  return { ok: true };
}

const CODE_ERRORS: Record<string, TwoFactorErrorKey> = {
  "000000": "invalidCode",
  "111111": "tooManyAttempts",
  "222222": "challengeExpired",
  "333333": "locked",
  "444444": "expiredOtp",
};

export async function stubVerify(
  code: string
): Promise<{ ok: true } | { error: TwoFactorErrorKey }> {
  await wait(900);
  const error = CODE_ERRORS[code.trim()];
  return error ? { error } : { ok: true };
}

export async function stubSendOtp(): Promise<{ ok: true }> {
  await wait(700);
  return { ok: true };
}

export function defaultTwoFactorMethod(methods: TwoFactorMethod[]): TwoFactorMethod {
  return methods.includes("totp") ? "totp" : "otp";
}

export function isChallengeDead(key: TwoFactorErrorKey, method: TwoFactorMethod): boolean {
  if (key === "challengeExpired") return true;
  return key === "tooManyAttempts" && method !== "otp";
}
