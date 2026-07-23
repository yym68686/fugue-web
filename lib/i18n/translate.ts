import type { Locale } from "@/lib/i18n/core";
import { zhCN } from "@/lib/i18n/messages";

export type TranslationValues = Record<string, string | number>;
export type MessageCatalog = Partial<Record<string, string>>;

const CATALOGS: Record<Locale, MessageCatalog> = {
  en: {},
  "zh-CN": zhCN,
};

/** Translate function bound to a locale. English keys are the source text, so
 * `en` falls back to the key itself; other locales look the string up. */
export type TranslateFn = (key: string, values?: TranslationValues) => string;

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const replacement = values[name];
    return replacement === undefined ? match : String(replacement);
  });
}

export function createTranslator(locale: Locale): TranslateFn {
  const catalog = CATALOGS[locale] ?? {};
  return (key, values) => {
    const template = locale === "en" ? key : catalog[key] ?? key;
    return interpolate(template, values);
  };
}
