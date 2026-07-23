// Locale model shared by server (cookie + Accept-Language resolution) and
// client (the language toggle in the user menu). Only English and Simplified
// Chinese are supported; every non-Chinese browser language falls back to en.

export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocalePreference = Locale | "auto";

export const SUPPORTED_LOCALE_SET = new Set<Locale>(SUPPORTED_LOCALES);
export const LOCALE_COOKIE_NAME = "fg_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALE_SET.has(value as Locale);
}

export function parseLocalePreference(
  value: string | null | undefined,
): LocalePreference {
  if (value === "auto") return "auto";
  return isLocale(value) ? value : "auto";
}

/**
 * Map an arbitrary language tag to a supported locale. Anything that looks like
 * Chinese ("zh", "zh-CN", "zh-Hans", "zh-TW", ...) resolves to zh-CN; every
 * other language resolves to English.
 */
export function resolveLanguageTag(tag: string | null | undefined): Locale {
  if (!tag) return DEFAULT_LOCALE;
  return /^zh\b/i.test(tag.trim()) ? "zh-CN" : "en";
}

/**
 * Resolve the effective locale from the browser's Accept-Language header. Picks
 * the first tag that maps to Chinese; otherwise English.
 */
export function resolveLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tags = header.split(",").map((part) => part.split(";")[0]?.trim() ?? "");
  for (const tag of tags) {
    if (/^zh\b/i.test(tag)) return "zh-CN";
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(
  preference: LocalePreference,
  acceptLanguage: string | null | undefined,
): Locale {
  if (preference === "auto") {
    return resolveLocaleFromAcceptLanguage(acceptLanguage);
  }
  return preference;
}
