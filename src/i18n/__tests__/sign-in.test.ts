import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

describe("auth.signIn", () => {
  it.each([
    ["en", en],
    ["cs", cs],
  ] as const)("carries no hint about setting a password on the web in %s", (_, dictionary) => {
    expect(dictionary.auth.signIn).not.toHaveProperty("socialHint");
    expect(dictionary.auth.signIn).not.toHaveProperty("socialHintLink");
  });

  it("returns the provider copy in English", () => {
    const copy = en.auth.signIn;

    expect(copy.signInWith).toEqual({
      apple: "Sign in with Apple",
      google: "Sign in with Google",
      microsoft: "Sign in with Microsoft",
    });
    expect(copy.emailInstead).toBe("Sign in with email instead");
    expect(copy.orWithEmail).toBe("or with email");
    expect(copy.accountNotLinked("Google")).toBe(
      "That email already has a Flexi Day account with a password. Sign in with the password, then connect Google from Settings on the web."
    );
    expect(copy.openSettings).toBe("Open Settings on the web");
    expect(copy.cancelled).toBe("Sign-in was cancelled.");
    expect(copy.generic).toBe("That sign-in could not be completed. Please try again.");
  });

  it("returns the provider copy in Czech", () => {
    const copy = cs.auth.signIn;

    expect(copy.signInWith).toEqual({
      apple: "Přihlásit se přes Apple",
      google: "Přihlásit se přes Google",
      microsoft: "Přihlásit se přes Microsoft",
    });
    expect(copy.emailInstead).toBe("Přihlásit se e-mailem");
    expect(copy.orWithEmail).toBe("nebo e-mailem");
    expect(copy.accountNotLinked("Microsoft")).toBe(
      "Tento e-mail už má účet Flexi Day s heslem. Přihlaste se heslem a v Nastavení na webu si pak připojte i Microsoft."
    );
    expect(copy.openSettings).toBe("Otevřít Nastavení na webu");
    expect(copy.cancelled).toBe("Přihlášení bylo zrušeno.");
    expect(copy.generic).toBe("Přihlášení se nepodařilo dokončit. Zkuste to prosím znovu.");
  });
});
