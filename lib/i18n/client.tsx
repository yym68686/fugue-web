"use client";

import { createContext, useContext, useMemo } from "react";

import type { Locale, LocalePreference } from "@/lib/i18n/core";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translate";

type I18nContextValue = {
  locale: Locale;
  preference: LocalePreference;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  preference,
  children,
}: {
  locale: Locale;
  preference: LocalePreference;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, preference, t: createTranslator(locale) }),
    [locale, preference],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    // Fallback when a client island is rendered outside a provider: default to
    // English so text still renders (keys are the English source).
    return {
      locale: "en",
      preference: "auto",
      t: createTranslator("en"),
    };
  }
  return value;
}

export function useT(): TranslateFn {
  return useI18n().t;
}
