import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import { DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID } from "@/lib/fugue/runtime-location";

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

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function shortId(value?: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "Unknown";
  }

  return normalized.slice(0, 8);
}

function readSharedGroupStatus(
  targets: ConsoleImportRuntimeTargetView[],
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
    statusLabel: `${targets.length} regions`,
    statusTone: "neutral",
  };
}

export function readRuntimeTargetOptionLabel(
  target: ConsoleImportRuntimeTargetView,
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
      ? "Any available region"
      : "Region unavailable";
  }

  return "Country unavailable";
}

export function readRuntimeTargetLabel(
  targets: ConsoleImportRuntimeTargetView[],
  runtimeId?: string | null,
  fallback = "Not assigned",
) {
  const normalized = normalizeText(runtimeId);

  if (!normalized) {
    return fallback;
  }

  return (
    targets.find((target) => target.id === normalized)?.summaryLabel ??
    shortId(normalized)
  );
}

export function buildImportRuntimeTargetGroups(
  targets: ConsoleImportRuntimeTargetView[],
): ConsoleImportRuntimeTargetGroupView[] {
  const groups: ConsoleImportRuntimeTargetGroupView[] = [];
  const internalClusterTargets = targets.filter(
    (target) => target.category === "internal-cluster",
  );

  if (internalClusterTargets.length > 0) {
    const groupStatus = readSharedGroupStatus(internalClusterTargets);

    groups.push({
      category: "internal-cluster",
      description: "Deploy onto the internal cluster.",
      id: INTERNAL_CLUSTER_GROUP_ID,
      kindLabel: "Shared",
      options: internalClusterTargets,
      primaryLabel: "Internal cluster",
      statusLabel: groupStatus.statusLabel,
      statusTone: groupStatus.statusTone,
      summaryLabel: "Internal cluster",
    });
  }

  for (const target of targets) {
    if (target.category !== "machine") {
      continue;
    }

    groups.push({
      category: "machine",
      description: "Deploy onto this machine.",
      id: target.id,
      kindLabel: "Machine",
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
