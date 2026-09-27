import { changePasswordRefusal, newPasswordProblem } from "@/lib/session/change-password";

describe("newPasswordProblem", () => {
  it("returns tooShort for a new password under eight characters", () => {
    expect(newPasswordProblem({ next: "short12", confirm: "short12" })).toBe("tooShort");
  });

  it("returns mismatch when the confirmation differs", () => {
    expect(newPasswordProblem({ next: "long enough", confirm: "long enougH" })).toBe("mismatch");
  });

  it("returns null for eight matching characters", () => {
    expect(newPasswordProblem({ next: "eight ch", confirm: "eight ch" })).toBeNull();
  });
});

describe("changePasswordRefusal", () => {
  it("returns wrongCurrent for better-auth's invalid password", () => {
    expect(changePasswordRefusal("INVALID_PASSWORD")).toBe("wrongCurrent");
  });

  it("returns the new-password keys for the length and breach refusals", () => {
    expect(changePasswordRefusal("PASSWORD_TOO_SHORT")).toBe("tooShort");
    expect(changePasswordRefusal("PASSWORD_TOO_LONG")).toBe("tooLong");
    expect(changePasswordRefusal("PASSWORD_COMPROMISED")).toBe("compromised");
  });

  it("returns null for any other code, or none", () => {
    expect(changePasswordRefusal("CREDENTIAL_ACCOUNT_NOT_FOUND")).toBeNull();
    expect(changePasswordRefusal(undefined)).toBeNull();
  });
});
