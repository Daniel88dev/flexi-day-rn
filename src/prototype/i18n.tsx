// PROTOTYPE. Throwaway strings for the welcome / sign-in / two-factor prototype. The real
// dictionaries land with the i18n port (issue 17).
import { getLocales } from "expo-localization";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "cs";

const en = {
  welcome: {
    tagline: "The calm, shared calendar for team time off.",
    headline: "Time off, handled with care.",
    quote: "The calmest part of our week is knowing exactly who's in and who's away.",
    signIn: "Sign in",
    createOnWeb: "Create an account on the web",
    signedOut: "You were signed out on this phone. Sign in again to continue.",
  },
  signIn: {
    title: "Welcome back",
    description: "Sign in to see who's in and who's away.",
    workEmail: "Work email",
    emailPlaceholder: "dana@northwind.co",
    password: "Password",
    passwordPlaceholder: "Your password",
    forgot: "Forgot password?",
    submit: "Sign in",
    submitting: "Signing in…",
    invalid: "Invalid email or password.",
    socialHint: "Signed up with Google or Microsoft?",
    socialHintLink: "Set a password on the web first.",
    newToApp: "New to flexiday?",
    createAccount: "Create an account",
    back: "Back",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
  twoFactor: {
    title: "Two-factor verification",
    choose: "How do you want to verify?",
    totpDescription: "Enter the code from your authenticator app.",
    otpDescription: "We emailed you a sign-in code.",
    backupDescription: "Enter one of your saved backup codes.",
    code: "Code",
    codePlaceholder: "123456",
    backupCode: "Backup code",
    backupPlaceholder: "xxxxx-xxxxx",
    submit: "Verify",
    submitting: "Verifying…",
    useAuthenticator: "Use your authenticator app",
    useEmail: "Email me a code",
    useBackup: "Use a backup code",
    resend: "Resend code",
    sending: "Sending…",
    sent: "Code sent. Check your inbox.",
    backToSignIn: "Back to sign in",
    methods: { totp: "Authenticator app", otp: "Email code", backup: "Backup code" },
    methodHints: {
      totp: "Six digits from your app",
      otp: "Sent to your inbox",
      backup: "One of your saved codes",
    },
    errors: {
      invalidCode: "That code isn't valid. Try again.",
      expiredOtp: "That code has expired. Request a new one.",
      tooManyAttempts: "Too many attempts. Sign in again to get a new challenge.",
      tooManyAttemptsOtp: "Too many attempts. Request a new code and try again.",
      challengeExpired: "This sign-in challenge has expired. Please sign in again.",
      locked:
        "Too many failed attempts. Your account is temporarily locked; try again in a few minutes.",
      rateLimited: "Too many requests. Wait a moment and try again.",
      generic: "Verification failed. Please try again.",
    },
  },
};

export type Dictionary = typeof en;

const cs: Dictionary = {
  welcome: {
    tagline: "Klidný sdílený kalendář volna pro celý tým.",
    headline: "Volno, vyřízené s péčí.",
    quote: "Nejklidnější částí našeho týdne je vědět přesně, kdo je v práci a kdo je pryč.",
    signIn: "Přihlásit se",
    createOnWeb: "Vytvořit účet na webu",
    signedOut: "Na tomto telefonu jste byli odhlášeni. Pro pokračování se znovu přihlaste.",
  },
  signIn: {
    title: "Vítejte zpět",
    description: "Přihlaste se a uvidíte, kdo je v práci a kdo je pryč.",
    workEmail: "Pracovní e-mail",
    emailPlaceholder: "dana@northwind.co",
    password: "Heslo",
    passwordPlaceholder: "Vaše heslo",
    forgot: "Zapomenuté heslo?",
    submit: "Přihlásit se",
    submitting: "Přihlašování…",
    invalid: "Neplatný e-mail nebo heslo.",
    socialHint: "Registrovali jste se přes Google nebo Microsoft?",
    socialHintLink: "Nejdřív si na webu nastavte heslo.",
    newToApp: "Nováček ve flexiday?",
    createAccount: "Vytvořit účet",
    back: "Zpět",
    showPassword: "Zobrazit heslo",
    hidePassword: "Skrýt heslo",
  },
  twoFactor: {
    title: "Dvoufázové ověření",
    choose: "Jak se chcete ověřit?",
    totpDescription: "Zadejte kód z ověřovací aplikace.",
    otpDescription: "Poslali jsme vám přihlašovací kód na e-mail.",
    backupDescription: "Zadejte jeden z uložených záložních kódů.",
    code: "Kód",
    codePlaceholder: "123456",
    backupCode: "Záložní kód",
    backupPlaceholder: "xxxxx-xxxxx",
    submit: "Ověřit",
    submitting: "Ověřování…",
    useAuthenticator: "Použít ověřovací aplikaci",
    useEmail: "Poslat kód na e-mail",
    useBackup: "Použít záložní kód",
    resend: "Poslat kód znovu",
    sending: "Odesílání…",
    sent: "Kód odeslán. Zkontrolujte schránku.",
    backToSignIn: "Zpět na přihlášení",
    methods: { totp: "Ověřovací aplikace", otp: "Kód e-mailem", backup: "Záložní kód" },
    methodHints: {
      totp: "Šest číslic z aplikace",
      otp: "Pošleme ho do vaší schránky",
      backup: "Jeden z uložených kódů",
    },
    errors: {
      invalidCode: "Neplatný kód. Zkuste to znovu.",
      expiredOtp: "Platnost kódu vypršela. Vyžádejte si nový.",
      tooManyAttempts: "Příliš mnoho pokusů. Přihlaste se prosím znovu.",
      tooManyAttemptsOtp: "Příliš mnoho pokusů. Vyžádejte si nový kód a zkuste to znovu.",
      challengeExpired: "Platnost přihlášení vypršela. Přihlaste se prosím znovu.",
      locked: "Příliš mnoho neúspěšných pokusů. Účet je dočasně uzamčen, zkuste to za pár minut.",
      rateLimited: "Příliš mnoho požadavků. Chvíli počkejte a zkuste to znovu.",
      generic: "Ověření se nezdařilo. Zkuste to znovu.",
    },
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, cs };

export function deviceLocale(): Locale {
  return getLocales()[0]?.languageCode === "cs" ? "cs" : "en";
}

type I18n = { locale: Locale; setLocale: (locale: Locale) => void; t: Dictionary };

const I18nContext = createContext<I18n>({ locale: "en", setLocale: () => {}, t: en });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(deviceLocale);
  const value = useMemo(() => ({ locale, setLocale, t: dictionaries[locale] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
