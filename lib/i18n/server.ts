import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";

import {
  LOCALE_COOKIE_NAME,
  type Locale,
  type LocalePreference,
  parseLocalePreference,
  resolveLocale,
} from "@/lib/i18n/core";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translate";

export type RequestI18n = {
  locale: Locale;
  preference: LocalePreference;
  t: TranslateFn;
};

/**
 * Resolve the request's locale from the fg_locale cookie (falling back to the
 * Accept-Language header when the preference is "auto") and return a bound
 * translate function. Cached per request render.
 */
export const getRequestI18n = cache(async (): Promise<RequestI18n> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const preference = parseLocalePreference(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  );
  const locale = resolveLocale(preference, headerStore.get("accept-language"));
  return { locale, preference, t: createTranslator(locale) };
});
