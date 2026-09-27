export const MIN_PASSWORD_LENGTH = 8;

export type NewPasswordProblem = "tooShort" | "mismatch";

export function newPasswordProblem({
  next,
  confirm,
}: {
  next: string;
  confirm: string;
}): NewPasswordProblem | null {
  if (next.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (next !== confirm) return "mismatch";
  return null;
}

export type ChangePasswordRefusal = "wrongCurrent" | "tooShort" | "tooLong" | "compromised";

export function changePasswordRefusal(
  code: string | null | undefined
): ChangePasswordRefusal | null {
  switch (code) {
    case "INVALID_PASSWORD":
      return "wrongCurrent";
    case "PASSWORD_TOO_SHORT":
      return "tooShort";
    case "PASSWORD_TOO_LONG":
      return "tooLong";
    case "PASSWORD_COMPROMISED":
      return "compromised";
    default:
      return null;
  }
}
