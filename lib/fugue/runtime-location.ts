import { readCountryCode, readCountryLabel } from "@/lib/geo/country";

const RUNTIME_REGION_LABEL_KEYS = [
  "topology.kubernetes.io/region",
  "failure-domain.beta.kubernetes.io/region",
  "region",
] as const;

const RUNTIME_ZONE_LABEL_KEYS = [
  "topology.kubernetes.io/zone",
  "failure-domain.beta.kubernetes.io/zone",
  "zone",
] as const;

const RUNTIME_COUNTRY_CODE_LABEL_KEYS = [
  "fugue.io/location-country-code",
  "country_code",
  "countryCode",
] as const;

type RuntimeLabels = Record<string, string> | null | undefined;

export type RuntimeLocationView = {
  hasPlacementConstraint: boolean;
  locationCountryCode: string | null;
  locationCountryLabel: string | null;
  locationLabel: string | null;
  regionLabel: string | null;
  zoneLabel: string | null;
};

function readFirstRuntimeLabel(
  labels: RuntimeLabels,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = labels?.[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readLocationLabel(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const countryCode = readCountryCode(trimmed);
  return countryCode ? readCountryLabel(countryCode) ?? trimmed : trimmed;
}

export function readRuntimeLocation(labels: RuntimeLabels): RuntimeLocationView {
  const regionLabel = readLocationLabel(
    readFirstRuntimeLabel(labels, RUNTIME_REGION_LABEL_KEYS),
  );
  const zoneLabel = readLocationLabel(
    readFirstRuntimeLabel(labels, RUNTIME_ZONE_LABEL_KEYS),
  );
  const countryCode =
    readCountryCode(readFirstRuntimeLabel(labels, RUNTIME_COUNTRY_CODE_LABEL_KEYS)) ??
    readCountryCode(readFirstRuntimeLabel(labels, RUNTIME_REGION_LABEL_KEYS));
  const locationCountryLabel = countryCode ? readCountryLabel(countryCode) : null;

  return {
    hasPlacementConstraint: Boolean(regionLabel || zoneLabel || countryCode),
    locationCountryCode: countryCode,
    locationCountryLabel,
    locationLabel: regionLabel ?? locationCountryLabel ?? zoneLabel,
    regionLabel,
    zoneLabel,
  };
}
