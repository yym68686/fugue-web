const COUNTRY_CODES = [
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
] as const;

type CountryCode = (typeof COUNTRY_CODES)[number];

export type CountryLocationView = {
  locationCountryCode: string | null;
  locationCountryLabel: string | null;
  locationLabel: string;
};

const COUNTRY_CODE_SET = new Set<string>(COUNTRY_CODES);
const REGION_DISPLAY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRY_NAME_ALIASES = {
  "czech republic": "CZ",
  "great britain": "GB",
  iran: "IR",
  laos: "LA",
  moldova: "MD",
  "north korea": "KP",
  russia: "RU",
  "south korea": "KR",
  syria: "SY",
  tanzania: "TZ",
  turkey: "TR",
  uk: "GB",
  usa: "US",
  "united states of america": "US",
  venezuela: "VE",
  vietnam: "VN",
} satisfies Record<string, CountryCode>;

function normalizeCountryKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

const COUNTRY_NAME_TO_CODE = (() => {
  const lookup = new Map<string, string>();

  for (const code of COUNTRY_CODES) {
    const label = REGION_DISPLAY_NAMES.of(code);

    if (!label) {
      continue;
    }

    lookup.set(normalizeCountryKey(label), code);
  }

  for (const [alias, code] of Object.entries(COUNTRY_NAME_ALIASES)) {
    lookup.set(normalizeCountryKey(alias), code);
  }

  return lookup;
})();

export function readCountryCode(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const upper = trimmed.toUpperCase();

  if (COUNTRY_CODE_SET.has(upper)) {
    return upper;
  }

  return COUNTRY_NAME_TO_CODE.get(normalizeCountryKey(trimmed)) ?? null;
}

export function readCountryLabel(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const countryCode = readCountryCode(trimmed);

  if (!countryCode) {
    return trimmed;
  }

  return REGION_DISPLAY_NAMES.of(countryCode) ?? trimmed;
}

export function readCountryLocation(
  region?: string | null,
  zone?: string | null,
): CountryLocationView {
  const normalizedRegion = region?.trim() || null;
  const normalizedZone = zone?.trim() || null;
  const locationCountryLabel = readCountryLabel(normalizedRegion);
  const locationLabelParts = [locationCountryLabel ?? normalizedRegion, normalizedZone].filter(
    (value): value is string => Boolean(value),
  );

  return {
    locationCountryCode: readCountryCode(normalizedRegion),
    locationCountryLabel,
    locationLabel: locationLabelParts.length ? locationLabelParts.join(" / ") : "Unassigned",
  };
}
