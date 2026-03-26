import type { ReactNode } from "react";

import { countryCodeToFlagEmoji } from "@/lib/geo/flag";
import { cx } from "@/lib/ui/cx";

export function CountryFlagLabel({
  className,
  countryCode,
  label,
}: {
  className?: string;
  countryCode?: string | null;
  label: ReactNode;
}) {
  const flag = countryCodeToFlagEmoji(countryCode);

  return (
    <span className={cx("fg-country-label", className)}>
      {flag ? (
        <span aria-hidden="true" className="fg-country-label__flag">
          {flag}
        </span>
      ) : null}
      <span className="fg-country-label__text">{label}</span>
    </span>
  );
}
