import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { createTranslator, negotiateLocale, type Locale } from "@/lib/i18n/core";

export const getRequestLocale = cache(async (): Promise<Locale> => {
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
