import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { deviceLocale, dictionaries, type Dictionary, type Locale } from "@/i18n";

type Translation = { locale: Locale; setLocale: (locale: Locale) => void; t: Dictionary };

const TranslationContext = createContext<Translation | null>(null);

/**
 * Locale follows the device and lasts for the session. A stored preference that follows the
 * user across web and phone is a decision of its own; this only reads what iOS reports.
 */
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(deviceLocale);
  const value = useMemo(() => ({ locale, setLocale, t: dictionaries[locale] }), [locale]);
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation(): Translation {
  const value = useContext(TranslationContext);
  if (!value) throw new Error("useTranslation must be used inside a TranslationProvider");
  return value;
}
