import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import { DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID } from "@/lib/fugue/runtime-location";
import { translate, type Locale } from "@/lib/i18n/core";

export type ConsoleImportRuntimeTargetGroupView = {
  category: "internal-cluster" | "machine";
  description: string;
  id: string;
  kindLabel: string;
  options: ConsoleImportRuntimeTargetView[];
  primaryLabel: string;
  statusLabel: string | null;
  statusTone: ConsoleTone | null;
  summaryLabel: string;
};

const INTERNAL_CLUSTER_GROUP_ID = "internal-cluster";
const SUPPORTED_LOCALE_SET = new Set<Locale>(["en", "zh-CN", "zh-TW"]);

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function shortId(locale: Locale, value?: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return translate(locale, "Unknown");
  }

  return normalized.slice(0, 8);
}

function readSharedGroupStatus(
  targets: ConsoleImportRuntimeTargetView[],
  locale: Locale,
): Pick<ConsoleImportRuntimeTargetGroupView, "statusLabel" | "statusTone"> {
  const statusLabel = targets[0]?.statusLabel ?? null;
  const statusTone = targets[0]?.statusTone ?? null;
  const hasUniformStatus = targets.every(
    (target) =>
      target.statusLabel === statusLabel && target.statusTone === statusTone,
  );

  if (hasUniformStatus) {
    return {
      statusLabel,
      statusTone,
    };
  }

  return {
    statusLabel: translate(
      locale,
      targets.length === 1 ? "{count} region" : "{count} regions",
      {
        count: targets.length,
      },
    ),
    statusTone: "neutral",
  };
}

export function readRuntimeTargetOptionLabel(
  target: ConsoleImportRuntimeTargetView,
  locale: Locale = "en",
) {
  const countryLabel = target.locationCountryLabel?.trim() ?? "";
  const locationLabel = target.locationLabel?.trim() ?? "";
  const locationParts = [
    countryLabel || null,
    locationLabel && locationLabel.toLowerCase() !== countryLabel.toLowerCase()
      ? locationLabel
      : null,
  ].filter((part): part is string => Boolean(part));

  if (locationParts.length) {
    return locationParts.join(" / ");
  }

  if (target.category === "internal-cluster") {
    return target.id === DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID
      ? translate(locale, "Any available region")
      : translate(locale, "Region unavailable");
  }

  return translate(locale, "Country unavailable");
}

export function readRuntimeTargetLabel(
  targets: ConsoleImportRuntimeTargetView[],
  runtimeId?: string | null,
  localeOrFallback: Locale | string = "en",
  fallback?: string,
) {
  const locale = SUPPORTED_LOCALE_SET.has(localeOrFallback as Locale)
    ? (localeOrFallback as Locale)
    : "en";
  const resolvedFallback =
    fallback ??
    (SUPPORTED_LOCALE_SET.has(localeOrFallback as Locale)
      ? translate(locale, "Not assigned")
      : localeOrFallback);
  const normalized = normalizeText(runtimeId);

  if (!normalized) {
    return resolvedFallback;
  }

  return (
    targets.find((target) => target.id === normalized)?.summaryLabel ??
    shortId(locale, normalized)
  );
}

export function isManagedRuntimeTarget(target: ConsoleImportRuntimeTargetView) {
  return (
    target.runtimeType === "managed-owned" ||
    target.runtimeType === "managed-shared"
  );
}

export function readManagedRuntimeTargets(
  targets: ConsoleImportRuntimeTargetView[],
  excludedRuntimeId?: string | null,
) {
  return targets.filter(
    (target) =>
      target.id !== excludedRuntimeId && isManagedRuntimeTarget(target),
  );
}

export function buildImportRuntimeTargetGroups(
  targets: ConsoleImportRuntimeTargetView[],
  locale: Locale = "en",
): ConsoleImportRuntimeTargetGroupView[] {
  const groups: ConsoleImportRuntimeTargetGroupView[] = [];
  const internalClusterTargets = targets.filter(
    (target) => target.category === "internal-cluster",
  );

  if (internalClusterTargets.length > 0) {
    const groupStatus = readSharedGroupStatus(internalClusterTargets, locale);

    groups.push({
      category: "internal-cluster",
      description: translate(locale, "Deploy onto the internal cluster."),
      id: INTERNAL_CLUSTER_GROUP_ID,
      kindLabel: translate(locale, "Shared"),
      options: internalClusterTargets,
      primaryLabel: translate(locale, "Internal cluster"),
      statusLabel: groupStatus.statusLabel,
      statusTone: groupStatus.statusTone,
      summaryLabel: translate(locale, "Internal cluster"),
    });
  }

  for (const target of targets) {
    if (target.category !== "machine") {
      continue;
    }

    groups.push({
      category: "machine",
      description: translate(locale, "Deploy onto this machine."),
      id: target.id,
      kindLabel: translate(locale, "Machine"),
      options: [target],
      primaryLabel: target.primaryLabel,
      statusLabel: target.statusLabel,
      statusTone: target.statusTone,
      summaryLabel: target.summaryLabel,
    });
  }

  return groups;
}

export function readDefaultImportRuntimeId(
  targets: ConsoleImportRuntimeTargetView[],
) {
  return (
    targets.find((target) => target.id === "runtime_managed_shared")?.id ??
    targets.find((target) => target.category === "internal-cluster")?.id ??
    targets[0]?.id ??
    null
  );
}

export function readDefaultRuntimeIdForTargetGroup(
  group: ConsoleImportRuntimeTargetGroupView | null | undefined,
) {
  return group ? readDefaultImportRuntimeId(group.options) : null;
}

export function readSelectedRuntimeTargetGroupId(
  groups: ConsoleImportRuntimeTargetGroupView[],
  runtimeId: string | null,
) {
  return (
    groups.find((group) =>
      group.options.some((option) => option.id === runtimeId),
    )?.id ??
    groups[0]?.id ??
    null
  );
}
