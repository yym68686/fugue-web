import type { Locale } from "@/lib/i18n/core";

// Regional-indicator math: an ISO-3166 alpha-2 code maps to a flag emoji by
// offsetting each letter into the Unicode regional-indicator block.
const REGIONAL_INDICATOR_A = 0x1f1e6;
const ASCII_A = 65;

/** Convert a 2-letter country code (e.g. "HK") to its flag emoji, or null. */
export function countryCodeToFlagEmoji(countryCode?: string | null): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }
  return [...normalized]
    .map((ch) => String.fromCodePoint(REGIONAL_INDICATOR_A + ch.charCodeAt(0) - ASCII_A))
    .join("");
}

/**
 * Recover the placement country from a managed runtime's id or name. Managed
 * shared runtimes encode their location as `country-<cc>` — e.g. the runtime id
 * "runtime_managed_shared_loc_country-hk-56a83941" and the name
 * "managed-shared-country-hk-56a8" both carry "hk". The backend also tags such
 * runtimes with a `fugue.io/location-country-code` label holding the same
 * 2-letter code, so id/name parsing recovers the authoritative value without an
 * extra runtimes lookup. Returns null for custom/BYO runtimes with no country.
 */
export function readRuntimeCountryCode(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const match = value?.match(/country[-:]([a-z]{2})(?![a-z])/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

// Intl.DisplayNames returns official long names ("Hong Kong SAR China"); prefer
// the shorter forms the console used before the rewrite for these regions.
const COUNTRY_LABEL_OVERRIDES: Record<string, Partial<Record<Locale, string>>> = {
  HK: { en: "Hong Kong", "zh-CN": "中国香港" },
  TW: { en: "Taiwan", "zh-CN": "中国台湾" },
  MO: { en: "Macau", "zh-CN": "中国澳门" },
};

/** Localized country name for a 2-letter code, or null when unknown. */
export function localizedCountryName(
  countryCode?: string | null,
  locale: Locale = "en",
): string | null {
  const cc = countryCode?.trim().toUpperCase();
  if (!cc || !/^[A-Z]{2}$/.test(cc)) {
    return null;
  }
  const override = COUNTRY_LABEL_OVERRIDES[cc]?.[locale];
  if (override) {
    return override;
  }
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}
