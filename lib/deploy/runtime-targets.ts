import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import type { FugueRuntime } from "@/lib/fugue/api";
import {
  DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID,
  hasInternalClusterLocationTarget,
  readRuntimeLocation,
} from "@/lib/fugue/runtime-location";

function humanize(value: string) {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function toneForRuntimeStatus(status?: string | null): ConsoleTone | null {
  const normalized = status?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("ready") ||
    normalized.includes("running") ||
    normalized.includes("active")
  ) {
    return "positive";
  }

  if (
    normalized.includes("error") ||
    normalized.includes("failed") ||
    normalized.includes("degraded")
  ) {
    return "danger";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("provision") ||
    normalized.includes("build")
  ) {
    return "warning";
  }

  if (
    normalized.includes("starting") ||
    normalized.includes("sync") ||
    normalized.includes("attach")
  ) {
    return "info";
  }

  return "neutral";
}

function buildDeployRuntimeTarget(
  runtime: FugueRuntime,
  workspaceTenantId: string,
): ConsoleImportRuntimeTargetView {
  const location = readRuntimeLocation(runtime.labels);
  const statusLabel = runtime.status ? humanize(runtime.status) : null;
  const statusTone = toneForRuntimeStatus(runtime.status);

  if (runtime.type === "managed-shared") {
    const isGenericInternalCluster =
      runtime.id === DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID &&
      !hasInternalClusterLocationTarget(runtime.labels);
    const primaryLabel = isGenericInternalCluster
      ? "Any available region"
      : location.locationCountryLabel ?? location.locationLabel ?? "Region unavailable";

    return {
      category: "internal-cluster",
      description:
        !isGenericInternalCluster && location.hasPlacementConstraint
          ? "Use shared capacity in this region."
          : "Deploy onto the internal cluster.",
      id: runtime.id,
      kindLabel: "Internal cluster",
      locationCountryCode: location.locationCountryCode,
      locationCountryLabel: location.locationCountryLabel,
      locationLabel: isGenericInternalCluster ? null : location.locationLabel,
      primaryLabel,
      runtimeType: runtime.type ?? null,
      statusLabel,
      statusTone,
      summaryLabel: `Internal cluster / ${primaryLabel}`,
    };
  }

  const primaryLabel =
    runtime.name?.trim() ||
    runtime.machineName?.trim() ||
    runtime.id;
  const isSharedMachine =
    runtime.type !== "managed-shared" &&
    Boolean(runtime.tenantId) &&
    runtime.tenantId !== workspaceTenantId;
  const isContributedMachine =
    runtime.type === "managed-owned" &&
    runtime.poolMode === "internal-shared" &&
    !isSharedMachine;

  return {
    category: "machine",
    description: isSharedMachine
      ? "Deploy onto a machine shared with this workspace."
      : isContributedMachine
        ? "Deploy onto this machine. It also contributes to the internal cluster."
        : "Deploy onto this machine.",
    id: runtime.id,
    kindLabel: isSharedMachine ? "Shared machine" : "Machine",
    locationCountryCode: location.locationCountryCode,
    locationCountryLabel: location.locationCountryLabel,
    locationLabel: location.locationLabel,
    primaryLabel,
    runtimeType: runtime.type ?? null,
    statusLabel,
    statusTone,
    summaryLabel: location.locationLabel
      ? `${primaryLabel} / ${location.locationLabel}`
      : primaryLabel,
  };
}

function compareDeployRuntimeTargets(
  left: ConsoleImportRuntimeTargetView,
  right: ConsoleImportRuntimeTargetView,
) {
  if (left.category !== right.category) {
    return left.category === "internal-cluster" ? -1 : 1;
  }

  const leftIsDefaultShared = left.id === DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID;
  const rightIsDefaultShared = right.id === DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID;

  if (leftIsDefaultShared !== rightIsDefaultShared) {
    return leftIsDefaultShared ? -1 : 1;
  }

  const primaryComparison = left.primaryLabel.localeCompare(right.primaryLabel, "en", {
    sensitivity: "base",
  });

  if (primaryComparison !== 0) {
    return primaryComparison;
  }

  return (left.locationLabel ?? "").localeCompare(right.locationLabel ?? "", "en", {
    sensitivity: "base",
  });
}

export function buildDeployRuntimeTargets(
  runtimes: FugueRuntime[],
  workspaceTenantId: string,
) {
  return [...runtimes]
    .map((runtime) => buildDeployRuntimeTarget(runtime, workspaceTenantId))
    .sort(compareDeployRuntimeTargets);
}
