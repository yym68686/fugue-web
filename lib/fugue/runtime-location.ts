import { readCountryCode, readCountryLabel } from "@/lib/geo/country";

export const DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID = "runtime_managed_shared";
export const INTERNAL_CLUSTER_LOCATION_KEY_LABEL =
  "fugue.io/internal-cluster-location-key";

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

export function hasInternalClusterLocationTarget(labels: RuntimeLabels) {
  return Boolean(
    readFirstRuntimeLabel(labels, [INTERNAL_CLUSTER_LOCATION_KEY_LABEL]),
  );
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
    locationLabel: locationCountryLabel ?? regionLabel ?? zoneLabel,
    regionLabel,
    zoneLabel,
  };
}

export function readManagedSharedRuntimeLabel(runtime: {
  id: string;
  labels?: RuntimeLabels;
}) {
  if (runtime.id === DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID) {
    return "Internal cluster";
  }

  const locationLabel = readRuntimeLocation(runtime.labels).locationLabel;
  return locationLabel ? `Internal cluster / ${locationLabel}` : "Internal cluster";
}
