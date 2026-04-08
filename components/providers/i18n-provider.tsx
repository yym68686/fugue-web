"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createTranslator,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  type Locale,
  type TranslationValues,
} from "@/lib/i18n/core";

type I18nContextValue = {
  formatDateTime: (value?: string | number | Date | null, options?: Parameters<typeof formatDateTime>[2]) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatRelativeTime: (value?: string | number | Date | null, options?: Parameters<typeof formatRelativeTime>[2]) => string;
  locale: Locale;
  t: (key: string, values?: TranslationValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const value = useMemo<I18nContextValue>(() => {
    const t = createTranslator(locale);

    return {
      formatDateTime: (input, options) => formatDateTime(locale, input, options),
      formatNumber: (input, options) => formatNumber(locale, input, options),
      formatRelativeTime: (input, options) => formatRelativeTime(locale, input, options),
      locale,
      t,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
}
