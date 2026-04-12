import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";

import {
  createTranslator,
  LOCALE_COOKIE_NAME,
  negotiateLocale,
  SUPPORTED_LOCALE_SET,
  type Locale,
} from "@/lib/i18n/core";

export const getRequestLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (storedLocale && SUPPORTED_LOCALE_SET.has(storedLocale as Locale)) {
    return storedLocale as Locale;
  }

  const headerStore = await headers();
  return negotiateLocale(headerStore.get("accept-language"));
});

export const getRequestI18n = cache(async () => {
  const locale = await getRequestLocale();

  return {
    locale,
    t: createTranslator(locale),
  };
});
