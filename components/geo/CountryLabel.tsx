"use client";

import { countryCodeToFlagEmoji, localizedCountryName } from "@/lib/geo/country";
import { useI18n } from "@/lib/i18n/client";

/**
 * Render a deployment location as a flag + localized country name. Driven by
 * the active locale so it follows the language toggle. Renders nothing when the
 * country can't be determined (e.g. custom/BYO runtimes with no country tag),
 * so callers can drop it in without guarding for the empty case.
 */
export default function CountryLabel({
  countryCode,
  className,
}: {
  countryCode?: string | null;
  className?: string;
}) {
  const { locale } = useI18n();
  const name = localizedCountryName(countryCode, locale);
  if (!name) {
    return null;
  }
  const flag = countryCodeToFlagEmoji(countryCode);
  return (
    <span className={`country-label${className ? ` ${className}` : ""}`}>
      {flag && (
        <span aria-hidden="true" className="country-label-flag">
          {flag}
        </span>
      )}
      <span className="country-label-text">{name}</span>
    </span>
  );
}
