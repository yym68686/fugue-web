import "server-only";

import { cache } from "react";

import type { ConsoleTone } from "@/lib/console/types";
import type {
  ConsoleGalleryAppView,
  ConsoleGalleryBadgeKind,
  ConsoleGalleryBadgeView,
  ConsoleGalleryBackingServiceView,
  ConsoleGalleryCommitView,
  ConsoleGalleryPersistentStorageMountView,
  ConsoleProjectDetailData,
  ConsoleGalleryProjectView,
  ConsoleProjectGallerySummaryData,
  ConsoleProjectLifecycleView,
  ConsoleProjectResourceUsageSnapshot,
  ConsoleImportRuntimeTargetView,
  ConsoleProjectGalleryData,
  ConsoleProjectSummaryView,
  ConsoleRuntimeTargetInventoryData,
} from "@/lib/console/gallery-types";
import { readProjectLifecycleTone } from "@/lib/console/project-lifecycle-tone";
import { buildProjectResourceUsageView } from "@/lib/console/project-resource-usage";
import {
  getFugueApps,
  getFugueClusterNodes,
  getFugueConsoleGallery,
  getFugueConsoleProject,
  getFugueOperations,
  getFugueProjects,
  getFugueProjectImageUsage,
  getFugueRuntimes,
  type FugueApp,
  type FugueAppPersistentStorageMount,
  type FugueAppPostgres,
  type FugueAppSource,
  type FugueBackingService,
  type FugueClusterNode,
  type FugueConsoleProjectDetail,
  type FugueConsoleProjectSummary,
  type FugueOperation,
  type FugueProject,
  type FugueAppTechnology,
  type FugueResourceUsage,
  type FugueRuntime,
} from "@/lib/fugue/api";
import {
  DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID,
  hasInternalClusterLocationTarget,
  readRuntimeLocation,
} from "@/lib/fugue/runtime-location";
import { readCountryLocation } from "@/lib/geo/country";
import {
  readGitHubBranchHref,
  readGitHubCommitHref,
} from "@/lib/fugue/source-links";
import {
  isDockerImageSourceType,
  readFugueSourceHref,
  readFugueSourceLabel,
  readFugueSourceMeta,
} from "@/lib/fugue/source-display";
import { isGitHubSourceType } from "@/lib/github/repository";
import {
  readBuildBadgeKind,
  readLanguageBadgeKind,
  readTechnologyLabel,
} from "@/lib/tech-stack";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";
import {
  getCurrentWorkspaceAccess,
  type WorkspaceAccess,
} from "@/lib/workspace/current";
import { createExpiringAsyncCache } from "@/lib/server/expiring-async-cache";
import { getRequestSession } from "@/lib/server/request-context";
import { translate, type Locale } from "@/lib/i18n/core";

type RuntimeTargetLocationView = {
  locationCountryCode: string | null;
  locationCountryLabel: string | null;
  locationLabel: string | null;
};

type ConsoleProjectGalleryUsageData = {
  projects: Array<{
    id: string;
    resourceUsageSnapshot: ConsoleProjectResourceUsageSnapshot;
  }>;
};

const CONSOLE_PROJECT_USAGE_CACHE_TTL_MS = 30_000;
const consoleProjectGalleryUsageCache =
  createExpiringAsyncCache<ConsoleProjectGalleryUsageData>(
    CONSOLE_PROJECT_USAGE_CACHE_TTL_MS,
  );

function readErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return "Unknown Fugue request error.";
}

function isUnauthorizedFugueError(reason: unknown) {
  return reason instanceof Error && reason.message.includes("401");
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Not yet";
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let valueForUnit = deltaSeconds;

  for (const { amount, unit } of units) {
    if (Math.abs(valueForUnit) < amount) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.trunc(valueForUnit),
        unit,
      );
    }

    valueForUnit /= amount;
  }

  return "Just now";
}

function formatExactTime(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function sumCurrentResourceUsage(
  items: Array<FugueResourceUsage | null | undefined>,
) {
  let cpuMillicores: number | null = null;
  let memoryBytes: number | null = null;
  let ephemeralStorageBytes: number | null = null;

  for (const item of items) {
    if (item?.cpuMillicores !== null && item?.cpuMillicores !== undefined) {
      cpuMillicores = (cpuMillicores ?? 0) + item.cpuMillicores;
    }

    if (item?.memoryBytes !== null && item?.memoryBytes !== undefined) {
      memoryBytes = (memoryBytes ?? 0) + item.memoryBytes;
    }

    if (
      item?.ephemeralStorageBytes !== null &&
      item?.ephemeralStorageBytes !== undefined
    ) {
      ephemeralStorageBytes =
        (ephemeralStorageBytes ?? 0) + item.ephemeralStorageBytes;
    }
  }

  return {
    cpuMillicores,
    ephemeralStorageBytes,
    memoryBytes,
  } satisfies FugueResourceUsage;
}

function buildWorkloadLocationMap(nodes: FugueClusterNode[]) {
  const locations = new Map<string, WorkloadLocationView>();

  for (const node of nodes) {
    const location = readCountryLocation(node.region, node.zone);
    const locationLabel =
      location.locationCountryLabel ??
      (location.locationLabel !== "Unassigned" ? location.locationLabel : null);

    if (!locationLabel) {
      continue;
    }

    const nextLocation = {
      locationCountryCode: location.locationCountryCode,
      locationLabel,
    } satisfies WorkloadLocationView;

    for (const workload of node.workloads) {
      const existing = locations.get(workload.id);

      if (existing?.locationCountryCode && !nextLocation.locationCountryCode) {
        continue;
      }

      locations.set(workload.id, nextLocation);
    }
  }

  return locations;
}

function normalizeRuntimeTargetLocation(
  location: {
  locationCountryCode: string | null;
  locationCountryLabel: string | null;
  locationLabel: string;
  },
  locale: Locale,
): RuntimeTargetLocationView | null {
  const locationLabel =
    location.locationCountryLabel ??
    (location.locationLabel !== translate(locale, "Unassigned")
      ? location.locationLabel
      : null);

  if (!locationLabel && !location.locationCountryCode) {
    return null;
  }

  return {
    locationCountryCode: location.locationCountryCode,
    locationCountryLabel: location.locationCountryLabel,
    locationLabel,
  };
}

function buildRuntimeTargetLocationMap(
  nodes: FugueClusterNode[],
  locale: Locale = "en",
) {
  const locations = new Map<string, RuntimeTargetLocationView>();
  const ambiguousLocation = {
    locationCountryCode: null,
    locationCountryLabel: null,
    locationLabel: null,
  } satisfies RuntimeTargetLocationView;
  const isSameLocation = (
    left: RuntimeTargetLocationView,
    right: RuntimeTargetLocationView,
  ) =>
    (left.locationCountryCode &&
      right.locationCountryCode &&
      left.locationCountryCode === right.locationCountryCode) ||
    (left.locationLabel &&
      right.locationLabel &&
      left.locationLabel === right.locationLabel);

  for (const node of nodes) {
    const nextLocation = normalizeRuntimeTargetLocation(
      readCountryLocation(node.region, node.zone, locale),
      locale,
    );

    if (!nextLocation) {
      continue;
    }

    const runtimeIds = new Set<string>();

    if (node.runtimeId) {
      runtimeIds.add(node.runtimeId);
    }

    for (const workload of node.workloads) {
      if (workload.runtimeId) {
        runtimeIds.add(workload.runtimeId);
      }
    }

    for (const runtimeId of runtimeIds) {
      const existing = locations.get(runtimeId);

      if (
        existing &&
        !existing.locationCountryCode &&
        !existing.locationLabel
      ) {
        locations.set(runtimeId, ambiguousLocation);
        continue;
      }

      if (existing && !isSameLocation(existing, nextLocation)) {
        locations.set(runtimeId, ambiguousLocation);
        continue;
      }

      if (existing?.locationCountryCode && !nextLocation.locationCountryCode) {
        continue;
      }

      locations.set(runtimeId, nextLocation);
    }
  }

  return locations;
}

function readRuntimeTargetLocationView(
  runtimeLocationsById: ReadonlyMap<string, RuntimeTargetLocationView>,
  runtimeId?: string | null,
): WorkloadLocationView | null {
  if (!runtimeId) {
    return null;
  }

  const location = runtimeLocationsById.get(runtimeId);

  if (!location) {
    return null;
  }

  return {
    locationCountryCode: location.locationCountryCode,
    locationLabel: location.locationLabel ?? location.locationCountryLabel,
  };
}

function humanize(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function shortId(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  if (value.length <= 20) {
    return value;
  }

  const prefix = value.split("_")[0] ?? value.slice(0, 3);
  return `${prefix}…${value.slice(-6)}`;
}

function normalizeHostname(value?: string | null) {
  const normalized =
    value?.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "") ?? "";
  return normalized || null;
}

function readAppPhaseLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("deployed") ||
    normalized.includes("running") ||
    normalized.includes("healthy") ||
    normalized.includes("active") ||
    normalized.includes("migrated") ||
    normalized.includes("failed-over")
  ) {
    return "Running";
  }

  return humanize(value);
}

function readAppFailoverState(
  app: Pick<FugueApp, "spec" | "status">,
): ConsoleGalleryAppView["failoverState"] {
  if (app.spec.failover) {
    return "configured";
  }

  const phase = app.status.phase?.trim().toLowerCase() ?? "";
  return phase.includes("failed-over") ? "unprotected" : "off";
}

function toneForAppFailoverState(
  state: ConsoleGalleryAppView["failoverState"],
): ConsoleTone {
  switch (state) {
    case "configured":
      return "info";
    case "unprotected":
      return "warning";
    case "off":
    default:
      return "neutral";
  }
}

function readRunningReleaseStatus(
  app: FugueApp,
  fallbackPhase: string,
  activeOperation?: FugueOperation | null,
) {
  if (activeOperation && (app.status.currentReplicas ?? 0) > 0) {
    // In-flight import/deploy operations temporarily overwrite `app.status.phase`
    // even while the current release still has live replicas serving traffic.
    return {
      phase: "Running",
      tone: "positive" as const,
    };
  }

  return {
    phase: readAppPhaseLabel(fallbackPhase),
    tone: toneForStatus(fallbackPhase),
  };
}

function shortCommitSha(value?: string | null) {
  const commit = value?.trim();

  if (!commit) {
    return "";
  }

  return commit.length > 8 ? commit.slice(0, 8) : commit;
}

const terminalOperationStatuses = new Set([
  "canceled",
  "cancelled",
  "completed",
  "failed",
]);

type AppCommitOperations = {
  active: FugueOperation | null;
  releases: FugueOperation[];
};

type WorkloadLocationView = Pick<
  ConsoleGalleryAppView,
  "locationCountryCode" | "locationLabel"
>;

function formatElapsedDuration(value?: string | null) {
  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return null;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingSeconds = elapsedSeconds % 60;

  if (elapsedMinutes < 60) {
    return remainingSeconds > 0
      ? `${elapsedMinutes}m ${remainingSeconds}s`
      : `${elapsedMinutes}m`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const remainingMinutes = elapsedMinutes % 60;

  if (elapsedHours < 24) {
    return remainingMinutes > 0
      ? `${elapsedHours}h ${remainingMinutes}m`
      : `${elapsedHours}h`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  const remainingHours = elapsedHours % 24;

  return remainingHours > 0
    ? `${elapsedDays}d ${remainingHours}h`
    : `${elapsedDays}d`;
}

function toneForStatus(status?: string | null): ConsoleTone {
  const normalized = status?.toLowerCase() ?? "";

  if (!normalized) {
    return "neutral";
  }

  if (
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("stopped") ||
    normalized.includes("deleting")
  ) {
    return "danger";
  }

  if (
    normalized.includes("queued") ||
    normalized.includes("pending") ||
    normalized.includes("migrating") ||
    normalized.includes("disabled")
  ) {
    return "warning";
  }

  if (
    normalized.includes("running") ||
    normalized.includes("building") ||
    normalized.includes("deploying") ||
    normalized.includes("importing") ||
    normalized.includes("transferring") ||
    normalized.includes("failing-over")
  ) {
    return "info";
  }

  if (
    normalized.includes("healthy") ||
    normalized.includes("active") ||
    normalized.includes("deployed") ||
    normalized.includes("completed") ||
    normalized.includes("migrated") ||
    normalized.includes("failed-over")
  ) {
    return "positive";
  }

  return "neutral";
}

function isManagedPostgresService(
  service: Pick<FugueBackingService, "type" | "provisioner">,
) {
  const normalizedType = service.type?.trim().toLowerCase() ?? "";
  const normalizedProvisioner =
    service.provisioner?.trim().toLowerCase() ?? "";

  return (
    normalizedType === "postgres" &&
    (normalizedProvisioner === "" || normalizedProvisioner === "managed")
  );
}

function isTerminalAppFailurePhase(phase?: string | null) {
  const normalized = phase?.trim().toLowerCase() ?? "";

  return (
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("stopped")
  );
}

function isActiveOperation(status?: string | null) {
  return !terminalOperationStatuses.has(status?.trim().toLowerCase() ?? "");
}

function readOperationTimestamp(operation: FugueOperation) {
  return parseTimestamp(
    operation.completedAt ??
      operation.updatedAt ??
      operation.startedAt ??
      operation.createdAt,
  );
}

function readOperationCommitSha(operation?: FugueOperation | null) {
  return operation?.desiredSource?.commitSha?.trim() || null;
}

function readOperationStartedAt(operation?: FugueOperation | null) {
  return operation?.startedAt?.trim() || operation?.createdAt?.trim() || null;
}

function readNormalizedOperationType(operation?: FugueOperation | null) {
  return operation?.type?.trim().toLowerCase() ?? "";
}

function readNormalizedOperationStatus(operation?: FugueOperation | null) {
  return operation?.status?.trim().toLowerCase() ?? "";
}

function isTransferOperation(operation?: FugueOperation | null) {
  const normalizedType = readNormalizedOperationType(operation);
  const normalizedStatus = readNormalizedOperationStatus(operation);

  return (
    normalizedType === "migrate" ||
    normalizedType === "failover" ||
    normalizedStatus.includes("migrat") ||
    normalizedStatus.includes("failover") ||
    normalizedStatus.includes("failing-over") ||
    normalizedStatus.includes("transfer")
  );
}

function isDatabaseTransferOperation(operation?: FugueOperation | null) {
  const normalizedType = readNormalizedOperationType(operation);
  const normalizedStatus = readNormalizedOperationStatus(operation);

  return (
    normalizedType === "database-switchover" ||
    normalizedStatus.includes("database-switchover") ||
    (normalizedStatus.includes("database") &&
      normalizedStatus.includes("switchover"))
  );
}

type DatabaseContinuitySnapshot = {
  failoverTargetRuntimeId: string | null;
  instances: number;
  primaryPlacementPendingRebalance: boolean;
  synchronousReplicas: number;
};

function readDatabaseContinuitySnapshot(
  postgres?: Pick<
    FugueAppPostgres,
    | "failoverTargetRuntimeId"
    | "instances"
    | "primaryPlacementPendingRebalance"
    | "synchronousReplicas"
  > | null,
): DatabaseContinuitySnapshot {
  return {
    failoverTargetRuntimeId: postgres?.failoverTargetRuntimeId?.trim() || null,
    instances: Math.max(postgres?.instances ?? 1, 1),
    primaryPlacementPendingRebalance:
      postgres?.primaryPlacementPendingRebalance ?? false,
    synchronousReplicas: Math.max(postgres?.synchronousReplicas ?? 0, 0),
  };
}

function hasDatabaseContinuityConfigured(snapshot: DatabaseContinuitySnapshot) {
  return Boolean(
    snapshot.failoverTargetRuntimeId ||
      (snapshot.instances > 1 && snapshot.synchronousReplicas > 0),
  );
}

function databaseContinuitySnapshotsEqual(
  left: DatabaseContinuitySnapshot,
  right: DatabaseContinuitySnapshot,
) {
  return (
    left.failoverTargetRuntimeId === right.failoverTargetRuntimeId &&
    left.instances === right.instances &&
    left.primaryPlacementPendingRebalance ===
      right.primaryPlacementPendingRebalance &&
    left.synchronousReplicas === right.synchronousReplicas
  );
}

function isQueuedOperationStatus(operation?: FugueOperation | null) {
  const normalizedStatus = readNormalizedOperationStatus(operation);
  return (
    normalizedStatus.includes("queued") || normalizedStatus.includes("pending")
  );
}

function isDatabaseContinuityOperationCandidate(
  operation?: FugueOperation | null,
) {
  return (
    isActiveOperation(operation?.status) && Boolean(operation?.desiredSpec?.postgres)
  );
}

function readDatabaseContinuityView(
  service: FugueBackingService,
  continuityOperation?: FugueOperation | null,
  ownerAppFailoverState: ConsoleGalleryAppView["failoverState"] = "off",
): ConsoleGalleryBackingServiceView["databaseContinuity"] {
  const current = readDatabaseContinuitySnapshot(service.spec.postgres);
  const desiredPostgres = continuityOperation?.desiredSpec?.postgres ?? null;
  const desired = desiredPostgres
    ? readDatabaseContinuitySnapshot(desiredPostgres)
    : current;
  const currentConfigured = hasDatabaseContinuityConfigured(current);
  const desiredConfigured = hasDatabaseContinuityConfigured(desired);
  const hasPendingTopologyChange =
    Boolean(desiredPostgres) && !databaseContinuitySnapshotsEqual(current, desired);

  if (hasPendingTopologyChange) {
    const queued = isQueuedOperationStatus(continuityOperation);

    if (!desiredConfigured) {
      return {
        label: queued ? "Disable queued" : "Removing standby",
        live: true,
        pendingTargetRuntimeId: null,
        placementPendingRebalance: desired.primaryPlacementPendingRebalance,
        state: queued ? "disable-queued" : "removing-standby",
        tone: queued ? "warning" : "info",
      };
    }

    if (!currentConfigured) {
      return {
        label: queued ? "Enable queued" : "Provisioning standby",
        live: true,
        pendingTargetRuntimeId: desired.failoverTargetRuntimeId,
        placementPendingRebalance: desired.primaryPlacementPendingRebalance,
        state: queued ? "enable-queued" : "provisioning-standby",
        tone: queued ? "warning" : "info",
      };
    }

    return {
      label: queued ? "Standby change queued" : "Updating standby",
      live: true,
      pendingTargetRuntimeId: desired.failoverTargetRuntimeId,
      placementPendingRebalance: desired.primaryPlacementPendingRebalance,
      state: queued ? "standby-update-queued" : "updating-standby",
      tone: queued ? "warning" : "info",
    };
  }

  if (
    !currentConfigured &&
    ownerAppFailoverState === "unprotected" &&
    isManagedPostgresService(service)
  ) {
    return {
      label: "Protection missing",
      live: false,
      pendingTargetRuntimeId: null,
      placementPendingRebalance: false,
      state: "unprotected",
      tone: "warning",
    };
  }

  if (currentConfigured) {
    return {
      label: "Configured",
      live: false,
      pendingTargetRuntimeId: null,
      placementPendingRebalance: current.primaryPlacementPendingRebalance,
      state: "configured",
      tone: "info",
    };
  }

  return {
    label: "Off",
    live: false,
    pendingTargetRuntimeId: null,
    placementPendingRebalance: current.primaryPlacementPendingRebalance,
    state: "off",
    tone: "neutral",
  };
}

function readDatabaseContinuityDescription(
  continuity: ConsoleGalleryBackingServiceView["databaseContinuity"],
) {
  switch (continuity.state) {
    case "disable-queued":
      return "Queued to remove the standby runtime.";
    case "enable-queued":
      return "Queued to add a standby runtime.";
    case "provisioning-standby":
      return "Preparing the standby while the current primary keeps serving writes.";
    case "removing-standby":
      return "Removing the standby while the current primary keeps serving writes.";
    case "standby-update-queued":
      return "Queued to update the standby runtime.";
    case "updating-standby":
      return "Updating the standby while the current primary keeps serving writes.";
    case "configured":
      return continuity.placementPendingRebalance
        ? "Standby runtime configured. Primary placement relaxes on the next rebalance."
        : "Standby runtime configured.";
    case "unprotected":
      return "Failover already promoted the standby. Choose a new standby to restore protection.";
    case "off":
    default:
      return continuity.placementPendingRebalance
        ? "Single-runtime database. Primary placement relaxes on the next rebalance."
        : "Single-runtime database.";
  }
}

function collectAppsWithLiveDatabaseContinuityTransition(
  backingServices: FugueBackingService[],
  operationsByAppId: ReadonlyMap<string, FugueOperation>,
) {
  const appIds = new Set<string>();

  for (const service of backingServices) {
    const ownerAppId = service.ownerAppId?.trim();
    const normalizedServiceType = service.type?.trim().toLowerCase() ?? "";

    if (!ownerAppId || normalizedServiceType !== "postgres") {
      continue;
    }

    const continuity = readDatabaseContinuityView(
      service,
      operationsByAppId.get(ownerAppId) ?? null,
    );

    if (continuity.live) {
      appIds.add(ownerAppId);
    }
  }

  return appIds;
}

function readDatabaseTransferState(operation?: FugueOperation | null) {
  const normalizedStatus = readNormalizedOperationStatus(operation);

  if (
    normalizedStatus.includes("queued") ||
    normalizedStatus.includes("pending")
  ) {
    return {
      description: "Queued to move the primary to the selected runtime.",
      status: "Transfer queued",
      tone: "warning" as ConsoleTone,
    };
  }

  return {
    description:
      "Preparing the destination runtime before Fugue promotes the new primary.",
    status: "Transferring",
    tone: "info" as ConsoleTone,
  };
}

function readActiveAppRuntimeId(app: FugueApp) {
  return app.status.currentRuntimeId?.trim() || app.spec.runtimeId?.trim() || null;
}

function isReleaseOperationCandidate(operation?: FugueOperation | null) {
  const normalizedType = readNormalizedOperationType(operation);
  const normalizedStatus = readNormalizedOperationStatus(operation);

  return (
    normalizedType === "import" ||
    normalizedType === "build" ||
    normalizedType === "deploy" ||
    normalizedStatus.includes("import") ||
    normalizedStatus.includes("build") ||
    normalizedStatus.includes("deploy") ||
    Boolean(operation?.desiredSource)
  );
}

function isBuildLogsOperationCandidate(operation?: FugueOperation | null) {
  const normalizedType = readNormalizedOperationType(operation);
  const normalizedStatus = readNormalizedOperationStatus(operation);

  return (
    normalizedType === "import" ||
    normalizedType === "build" ||
    normalizedStatus.includes("import") ||
    normalizedStatus.includes("build")
  );
}

function findBuildLogsOperationForCommit(
  operations: FugueOperation[],
  commitSha: string,
  options: {
    preferActive: boolean;
  },
) {
  const releaseMatches = operations.filter(
    (operation) =>
      readOperationCommitSha(operation) === commitSha &&
      isReleaseOperationCandidate(operation),
  );
  const buildMatches = releaseMatches.filter((operation) =>
    isBuildLogsOperationCandidate(operation),
  );
  const readActiveMatch = (items: FugueOperation[]) =>
    items.find((operation) => isActiveOperation(operation.status)) ?? null;
  const readTerminalMatch = (items: FugueOperation[]) =>
    items.find((operation) => !isActiveOperation(operation.status)) ?? null;

  if (options.preferActive) {
    return (
      readActiveMatch(buildMatches) ??
      buildMatches[0] ??
      null
    );
  }

  return (
    readTerminalMatch(buildMatches) ??
    buildMatches[0] ??
    null
  );
}

function readRunningBuildLogsOperation(
  app: FugueApp,
  commitOperations?: AppCommitOperations,
) {
  const releaseOperations = commitOperations?.releases ?? [];
  const runningCommitSha = app.source.commitSha?.trim() || null;

  if (runningCommitSha) {
    const matchingCommitOperation = findBuildLogsOperationForCommit(
      releaseOperations,
      runningCommitSha,
      {
        preferActive: false,
      },
    );

    if (matchingCommitOperation) {
      return matchingCommitOperation;
    }
  }

  const lastOperationId = app.status.lastOperationId?.trim() || null;

  if (lastOperationId) {
    const matchingLastOperation = releaseOperations.find(
      (operation) =>
        operation.id === lastOperationId &&
        isBuildLogsOperationCandidate(operation) &&
        !isActiveOperation(operation.status),
    );

    if (matchingLastOperation) {
      return matchingLastOperation;
    }
  }

  return (
    releaseOperations.find(
      (operation) =>
        isBuildLogsOperationCandidate(operation) &&
        !isActiveOperation(operation.status),
    ) ??
    null
  );
}

function readPendingBuildLogsOperation(
  activeOperation: FugueOperation | null,
  commitOperations?: AppCommitOperations,
) {
  const releaseOperations = commitOperations?.releases ?? [];
  const pendingCommitSha = readOperationCommitSha(activeOperation);

  if (pendingCommitSha) {
    const matchingCommitOperation = findBuildLogsOperationForCommit(
      releaseOperations,
      pendingCommitSha,
      {
        preferActive: true,
      },
    );

    if (matchingCommitOperation) {
      return matchingCommitOperation;
    }
  }

  if (activeOperation && isBuildLogsOperationCandidate(activeOperation)) {
    return activeOperation;
  }

  return (
    releaseOperations.find(
      (operation) =>
        isBuildLogsOperationCandidate(operation) &&
        isActiveOperation(operation.status),
    ) ??
    releaseOperations.find(
      (operation) =>
        isBuildLogsOperationCandidate(operation) &&
        !isActiveOperation(operation.status),
    ) ??
    null
  );
}

type ReleaseFailureSummary = {
  logsMode: "build" | "runtime" | null;
  message: string | null;
  operation: FugueOperation;
};

const runtimeReleaseFailurePattern =
  /\b(pod|container|crashloopbackoff|oomkilled|exit_code|runcontainer|createcontainer|errimagepull|imagepullbackoff|readiness probe|liveness probe|startup probe)\b/i;

const releaseFailurePrefixPatterns = [
  /^wait for managed app rollout [^:]+:\s*/i,
  /^managed app [^:]+ rollout failed:\s*/i,
  /^wait for deployment rollout [^:]+:\s*/i,
  /^deployment [^:]+ rollout failed:\s*/i,
  /^wait for builder job [^:]+:\s*/i,
  /^build job [^:]+ failed:\s*/i,
];

function readLatestFailedReleaseOperation(
  commitOperations?: AppCommitOperations,
) {
  return (
    commitOperations?.releases.find((operation) => {
      const normalizedStatus = readNormalizedOperationStatus(operation);
      return (
        !isActiveOperation(operation.status) &&
        (normalizedStatus.includes("failed") ||
          Boolean(operation.errorMessage?.trim()))
      );
    }) ?? null
  );
}

function classifyReleaseFailureLogsMode(
  operation?: FugueOperation | null,
): "build" | "runtime" | null {
  const normalizedType = readNormalizedOperationType(operation);
  const normalizedStatus = readNormalizedOperationStatus(operation);

  if (
    normalizedType === "import" ||
    normalizedType === "build" ||
    normalizedStatus.includes("import") ||
    normalizedStatus.includes("build")
  ) {
    return "build";
  }

  if (
    (normalizedType === "deploy" ||
      normalizedType === "migrate" ||
      normalizedType === "failover" ||
      normalizedStatus.includes("deploy") ||
      normalizedStatus.includes("migrat") ||
      normalizedStatus.includes("failover") ||
      normalizedStatus.includes("failing-over")) &&
    runtimeReleaseFailurePattern.test(
      `${operation?.errorMessage ?? ""} ${operation?.resultMessage ?? ""}`,
    )
  ) {
    return "runtime";
  }

  return null;
}

function stripReleaseFailurePrefixes(value?: string | null) {
  let message = normalizeServiceMessage(value);

  if (!message) {
    return null;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of releaseFailurePrefixPatterns) {
      const next = message.replace(pattern, "").trim();
      if (next !== message) {
        message = next;
        changed = true;
      }
    }
  }

  return normalizeServiceMessage(message);
}

function readReleaseFailureSummary(
  commitOperations?: AppCommitOperations,
): ReleaseFailureSummary | null {
  const operation = readLatestFailedReleaseOperation(commitOperations);

  if (!operation) {
    return null;
  }

  return {
    logsMode: classifyReleaseFailureLogsMode(operation),
    message: stripReleaseFailurePrefixes(
      operation.errorMessage?.trim() || operation.resultMessage?.trim(),
    ),
    operation,
  };
}

function isDatabaseContinuityOnlyDeployOperation(
  app: FugueApp,
  operation: FugueOperation | null | undefined,
  hasLiveDatabaseContinuityTransition: boolean,
) {
  if (!operation || !hasLiveDatabaseContinuityTransition) {
    return false;
  }

  const normalizedType = readNormalizedOperationType(operation);

  if (normalizedType !== "deploy" || operation.desiredSource) {
    return false;
  }

  const activeRuntimeId = readActiveAppRuntimeId(app);
  const targetRuntimeId = operation.targetRuntimeId?.trim() || null;

  return (
    Boolean(operation.desiredSpec?.postgres) &&
    (!targetRuntimeId || !activeRuntimeId || targetRuntimeId === activeRuntimeId)
  );
}

function normalizeServiceMessage(value?: string | null) {
  const message = value?.trim().replace(/\s+/g, " ") ?? "";

  if (!message) {
    return null;
  }

  if (/^deployment ready(?: \(\d+\/\d+ replicas\))?$/i.test(message)) {
    return null;
  }

  return message;
}

function hasLiveRelease(app: FugueApp) {
  const normalizedPhase = app.status.phase?.trim().toLowerCase() ?? "";

  if ((app.status.currentReplicas ?? 0) > 0) {
    return true;
  }

  // `commitSha` and runtime placement can be populated before the first rollout
  // is actually live. During that window the console should keep showing a
  // single pending service card instead of inventing a second "running" card.
  // Terminal failed states also do not count as a live release, but they stay
  // visible through `readActiveReleaseOperation` so the operator can inspect
  // the failure instead of losing the failed card behind a pending rollout.

  return (
    normalizedPhase.length > 0 &&
    [
      "running",
      "healthy",
      "active",
      "deployed",
      "disabled",
      "paused",
      "migrated",
      "failed-over",
    ].some((keyword) => normalizedPhase.includes(keyword))
  );
}

function readActiveReleaseOperation(
  operation: FugueOperation | null | undefined,
  app: FugueApp,
) {
  if (!operation) {
    return null;
  }

  if (isTerminalAppFailurePhase(app.status.phase)) {
    return null;
  }

  const normalizedType = operation.type?.trim().toLowerCase() ?? "";
  const normalizedStatus = operation.status?.trim().toLowerCase() ?? "";
  const desiredCommit = readOperationCommitSha(operation);
  const runningCommit = app.source.commitSha?.trim() || null;
  const activeRuntimeId = readActiveAppRuntimeId(app);
  const targetRuntimeId = operation.targetRuntimeId?.trim() || null;

  if (
    normalizedType === "import" ||
    normalizedType === "build" ||
    normalizedType === "deploy"
  ) {
    return operation;
  }

  if (
    (normalizedType === "migrate" || normalizedType === "failover") &&
    targetRuntimeId &&
    targetRuntimeId !== activeRuntimeId
  ) {
    return operation;
  }

  if (
    normalizedStatus.includes("import") ||
    normalizedStatus.includes("build") ||
    normalizedStatus.includes("deploy")
  ) {
    return operation;
  }

  if (
    (normalizedStatus.includes("migrat") ||
      normalizedStatus.includes("failover") ||
      normalizedStatus.includes("failing-over") ||
      normalizedStatus.includes("transfer")) &&
    targetRuntimeId &&
    targetRuntimeId !== activeRuntimeId
  ) {
    return operation;
  }

  if (desiredCommit && desiredCommit !== runningCommit) {
    return operation;
  }

  if (
    (normalizedStatus.includes("queued") ||
      normalizedStatus.includes("pending") ||
      normalizedStatus.includes("migrating") ||
      normalizedStatus.includes("running")) &&
    operation.desiredSource
  ) {
    return operation;
  }

  return null;
}

function readRunningServiceMessage(
  app: FugueApp,
  commitOperations?: AppCommitOperations,
  activeOperation?: FugueOperation | null,
) {
  if (activeOperation) {
    if (isTransferOperation(activeOperation)) {
      return readPendingCommitState(activeOperation).stateLabel ===
        "Transfer queued"
        ? "Serving the current runtime while the transfer waits to start."
        : "Serving the current runtime while the transfer prepares the destination.";
    }

    const pendingState = readPendingCommitState(activeOperation).stateLabel;

    if (pendingState === "Queued") {
      return "Serving the current release while the next release waits to start.";
    }

    if (pendingState === "Deploying") {
      return "Serving the current release while the next release deploys.";
    }

    return "Serving the current release while the next release builds.";
  }

  const failureSummary = isTerminalAppFailurePhase(app.status.phase)
    ? readReleaseFailureSummary(commitOperations)
    : null;

  if (failureSummary?.message) {
    return failureSummary.message;
  }

  return normalizeServiceMessage(app.status.lastMessage);
}

function readPendingServiceMessage(app: FugueApp, operation: FugueOperation) {
  if (isTransferOperation(operation)) {
    return readPendingCommitState(operation).stateLabel === "Transfer queued"
      ? "Queued to transfer this service to the selected runtime."
      : "Preparing the destination runtime before traffic switches over.";
  }

  const operationMessage = normalizeServiceMessage(
    operation.resultMessage?.trim() || operation.errorMessage?.trim(),
  );

  if (operationMessage) {
    return operationMessage;
  }

  const appMessage = normalizeServiceMessage(app.status.lastMessage);

  if (appMessage) {
    return appMessage;
  }

  return `${readPendingCommitState(operation).stateLabel} the next release.`;
}

function readPendingCommitState(
  operation?: FugueOperation | null,
): Pick<ConsoleGalleryCommitView, "stateLabel" | "tone"> {
  const normalizedStatus = operation?.status?.trim().toLowerCase() ?? "";
  const normalizedType = operation?.type?.trim().toLowerCase() ?? "";

  if (
    normalizedStatus.includes("queued") ||
    normalizedStatus.includes("pending")
  ) {
    if (isTransferOperation(operation)) {
      return {
        stateLabel: "Transfer queued",
        tone: "warning",
      };
    }

    return {
      stateLabel: "Queued",
      tone: "warning",
    };
  }

  if (
    normalizedType === "migrate" ||
    normalizedType === "failover" ||
    normalizedStatus.includes("migrat") ||
    normalizedStatus.includes("failover") ||
    normalizedStatus.includes("failing-over") ||
    normalizedStatus.includes("transfer")
  ) {
    return {
      stateLabel: "Transferring",
      tone: "info",
    };
  }

  if (normalizedType === "deploy" || normalizedStatus.includes("deploy")) {
    return {
      stateLabel: "Deploying",
      tone: "info",
    };
  }

  if (
    normalizedType === "import" ||
    normalizedType === "build" ||
    normalizedStatus.includes("build") ||
    normalizedStatus.includes("import")
  ) {
    return {
      stateLabel: "Building",
      tone: "info",
    };
  }

  if (normalizedStatus.includes("running")) {
    return {
      stateLabel: "Updating",
      tone: "info",
    };
  }

  return {
    stateLabel: humanize(operation?.status ?? operation?.type ?? "Pending"),
    tone: toneForStatus(operation?.status ?? operation?.type),
  };
}

function buildCommitView({
  fallbackLabel,
  fallbackRepoUrl,
  kind,
  source,
  stateLabel,
  tone,
}: {
  fallbackLabel?: string | null;
  fallbackRepoUrl?: string | null;
  kind: ConsoleGalleryCommitView["kind"];
  source?: FugueAppSource | null;
  stateLabel: string;
  tone: ConsoleTone;
}): ConsoleGalleryCommitView | null {
  const exact = source?.commitSha?.trim() || null;
  const label = exact ? shortCommitSha(exact) : fallbackLabel?.trim() || null;

  if (!label) {
    return null;
  }

  return {
    committedAt: source?.commitCommittedAt?.trim() || null,
    exact,
    href: readGitHubCommitHref(source?.repoUrl ?? fallbackRepoUrl, exact),
    id: `${kind}:${exact ?? label}`,
    kind,
    label,
    stateLabel,
    tone,
  };
}

function buildCommitViews(
  app: FugueApp,
  activeOperation?: FugueOperation | null,
): ConsoleGalleryCommitView[] {
  const pendingOperation = activeOperation ?? null;
  const pendingCommitSha = readOperationCommitSha(pendingOperation);
  const runningCommitSha = app.source.commitSha?.trim() || null;

  const runningCommit = buildCommitView({
    fallbackLabel:
      isGitHubSource(app) && !pendingCommitSha ? "Pending first import" : null,
    fallbackRepoUrl: app.source.repoUrl,
    kind: "running",
    // `app.source` stays on the live release until the deploy finishes.
    // Completed import operations already describe the next release, so they
    // must not replace the running commit shown in the inspector.
    source: app.source,
    stateLabel: "Running",
    tone: "positive",
  });

  const pendingCommit =
    pendingCommitSha && pendingCommitSha !== runningCommitSha
      ? buildCommitView({
          fallbackRepoUrl: app.source.repoUrl,
          kind: "pending",
          source: pendingOperation?.desiredSource,
          ...readPendingCommitState(pendingOperation),
        })
      : null;

  if (runningCommit && pendingCommit) {
    return [runningCommit, pendingCommit];
  }

  if (runningCommit) {
    return [runningCommit];
  }

  if (pendingCommit) {
    return [pendingCommit];
  }

  return [];
}

function collectCommitOperationsByAppId(operations: FugueOperation[]) {
  const commitOperationsByAppId = new Map<string, AppCommitOperations>();

  for (const operation of sortByTimestampDesc(
    operations,
    readOperationTimestamp,
  )) {
    if (!operation.appId) {
      continue;
    }

    const entry = commitOperationsByAppId.get(operation.appId) ?? {
      active: null,
      releases: [],
    };

    if (isActiveOperation(operation.status)) {
      if (!entry.active) {
        entry.active = operation;
      }
    }

    if (isReleaseOperationCandidate(operation)) {
      entry.releases.push(operation);
    }

    commitOperationsByAppId.set(operation.appId, entry);
  }

  return commitOperationsByAppId;
}

function collectDatabaseTransferOperationsByAppId(operations: FugueOperation[]) {
  const databaseTransferOperationsByAppId = new Map<string, FugueOperation>();

  for (const operation of sortByTimestampDesc(operations, readOperationTimestamp)) {
    if (
      !operation.appId ||
      databaseTransferOperationsByAppId.has(operation.appId) ||
      !isActiveOperation(operation.status) ||
      !isDatabaseTransferOperation(operation)
    ) {
      continue;
    }

    databaseTransferOperationsByAppId.set(operation.appId, operation);
  }

  return databaseTransferOperationsByAppId;
}

function collectDatabaseContinuityOperationsByAppId(
  operations: FugueOperation[],
) {
  const databaseContinuityOperationsByAppId = new Map<string, FugueOperation>();

  for (const operation of sortByTimestampDesc(operations, readOperationTimestamp)) {
    if (
      !operation.appId ||
      databaseContinuityOperationsByAppId.has(operation.appId) ||
      !isDatabaseContinuityOperationCandidate(operation)
    ) {
      continue;
    }

    databaseContinuityOperationsByAppId.set(operation.appId, operation);
  }

  return databaseContinuityOperationsByAppId;
}

function readRoute(app: FugueApp) {
  if (app.spec.networkMode === "background") {
    return {
      href: null,
      label: "Background worker",
    };
  }

  if (app.route.publicUrl) {
    try {
      const url = new URL(app.route.publicUrl);
      return {
        href: app.route.publicUrl,
        label: url.host,
      };
    } catch {
      return {
        href: app.route.publicUrl,
        label: app.route.publicUrl,
      };
    }
  }

  if (app.route.hostname) {
    return {
      href: null,
      label: app.route.hostname,
    };
  }

  if (app.route.servicePort) {
    return {
      href: null,
      label: `private / :${app.route.servicePort}`,
    };
  }

  return {
    href: null,
    label: "Unassigned",
  };
}

function readRouteHostname(app: FugueApp) {
  const hostname = normalizeHostname(app.route.hostname);

  if (hostname) {
    return hostname;
  }

  const publicUrl = app.route.publicUrl?.trim();

  if (!publicUrl) {
    return null;
  }

  try {
    return normalizeHostname(new URL(publicUrl).hostname);
  } catch {
    return null;
  }
}

function readRouteBaseDomain(hostname?: string | null) {
  const normalized = normalizeHostname(hostname);

  if (!normalized) {
    return null;
  }

  const segments = normalized.split(".").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  return segments.slice(1).join(".");
}

function readAppRouteBaseDomain(app: FugueApp) {
  return (
    normalizeHostname(app.route.baseDomain) ??
    readRouteBaseDomain(readRouteHostname(app))
  );
}

function isGitHubAppSource(source?: FugueAppSource | null) {
  return isGitHubSourceType(source?.type);
}

function isDockerImageAppSource(source?: FugueAppSource | null) {
  return isDockerImageSourceType(source?.type);
}

function isUploadAppSource(source?: FugueAppSource | null) {
  return source?.type?.trim().toLowerCase() === "upload";
}

function readSourceLabelFromSource(source: FugueAppSource) {
  return readFugueSourceLabel(source);
}

function readSourceLabel(app: FugueApp) {
  return readSourceLabelFromSource(app.source);
}

function isGitHubSource(app: FugueApp) {
  return isGitHubAppSource(app.source);
}

function isUploadSource(app: FugueApp) {
  return isUploadAppSource(app.source);
}

function isDockerImageSource(app: FugueApp) {
  return isDockerImageAppSource(app.source);
}

function readSourceBranchLabelFromSource(source: FugueAppSource) {
  if (!isGitHubAppSource(source)) {
    return null;
  }

  return source.repoBranch?.trim() || "Default branch";
}

function readSourceBranchLabel(app: FugueApp) {
  return readSourceBranchLabelFromSource(app.source);
}

function readCurrentCommitLabel(app: FugueApp) {
  if (!isGitHubSource(app)) {
    return null;
  }

  return shortCommitSha(app.source.commitSha) || "Pending first import";
}

function readRedeployAction(app: FugueApp) {
  if (isGitHubSource(app)) {
    return {
      description:
        "Pull the latest code from the tracked branch, rebuild from scratch, and roll out the new release. Persistent storage is preserved when configured. Fugue also redeploys automatically when upstream commits change and the app is idle.",
      label: "Redeploy",
      loadingLabel: "Redeploying…",
      queuedMessage: "Redeploy queued.",
    };
  }

  if (isDockerImageSource(app)) {
    return {
      description:
        "Pull the saved image reference again, mirror it into Fugue’s internal registry, and roll out a new release. Persistent storage is preserved when configured.",
      label: "Repull image",
      loadingLabel: "Repulling image…",
      queuedMessage: "Image repull queued.",
    };
  }

  return {
    description:
      "Rebuild from the saved source from scratch and roll out a new release. Persistent storage is preserved when configured.",
    label: "Redeploy",
    loadingLabel: "Redeploying…",
    queuedMessage: "Redeploy queued.",
  };
}

function readDeployBehavior(app: FugueApp) {
  if (isGitHubSource(app) || isUploadSource(app) || isDockerImageSource(app)) {
    return "Deploy completes only after the new Kubernetes rollout is ready and old replicas have drained.";
  }

  return "Deploy completes only after the new Kubernetes rollout is ready.";
}

function readRedeployState(app: FugueApp) {
  const sourceType = app.source.type?.trim().toLowerCase() ?? "";

  if (
    isGitHubSourceType(sourceType) ||
    sourceType === "docker-image" ||
    sourceType === "upload"
  ) {
    return {
      canRedeploy: true,
      redeployDisabledReason: null,
    };
  }

  if (!sourceType) {
    return {
      canRedeploy: false,
      redeployDisabledReason:
        "Redeploy requires an imported source definition.",
    };
  }

  return {
    canRedeploy: false,
    redeployDisabledReason: `Redeploy only works for imported GitHub, Docker image, or upload apps. Current source: ${humanize(app.source.type)}.`,
  };
}

function sortByTimestampDesc<T>(
  items: T[],
  readTimestamp: (item: T) => number,
) {
  return [...items].sort(
    (left, right) => readTimestamp(right) - readTimestamp(left),
  );
}

function readAppTimestamp(app: FugueApp) {
  return parseTimestamp(app.status.updatedAt ?? app.updatedAt ?? app.createdAt);
}

function readAppCreationTimestamp(app: FugueApp) {
  return parseTimestamp(app.createdAt ?? app.updatedAt);
}

function readServiceTimestamp(service: FugueBackingService) {
  return parseTimestamp(service.updatedAt ?? service.createdAt);
}

function readServiceCreationTimestamp(service: FugueBackingService) {
  return parseTimestamp(service.createdAt ?? service.updatedAt);
}

function readProjectCreationTimestamp(project: FugueProject) {
  return parseTimestamp(project.createdAt ?? project.updatedAt);
}

function readDerivedProjectCreationTimestamp(
  apps: FugueApp[],
  services: FugueBackingService[],
) {
  const timestamps = [
    ...apps.map(readAppCreationTimestamp),
    ...services.map(readServiceCreationTimestamp),
  ].filter((timestamp) => timestamp > 0);

  if (!timestamps.length) {
    return 0;
  }

  return Math.min(...timestamps);
}

function readBadgeKey(kind: ConsoleGalleryBadgeKind, label: string) {
  return `${kind}:${label}`.toLowerCase();
}

function buildBadgeFromTechStack(
  item: FugueAppTechnology,
  options?: {
    includeBuild?: boolean;
  },
): ConsoleGalleryBadgeView | null {
  const normalizedKind = item.kind.trim().toLowerCase();
  const normalizedSlug = item.slug.trim().toLowerCase();
  const normalizedName = item.name.trim();

  if (!normalizedKind || normalizedKind === "source") {
    return null;
  }

  if (normalizedKind === "language" || normalizedKind === "stack") {
    const label =
      normalizedName ||
      readTechnologyLabel(normalizedSlug) ||
      humanize(normalizedSlug);
    const kind = readLanguageBadgeKind(normalizedSlug) ?? "runtime";
    return {
      id: readBadgeKey(kind, label),
      kind,
      label,
      meta: normalizedKind === "stack" ? "Stack" : "Language",
    };
  }

  if (normalizedKind === "service") {
    const label =
      normalizedSlug === "postgres"
        ? "PostgreSQL"
        : normalizedName || humanize(normalizedSlug);
    const kind = normalizedSlug === "postgres" ? "postgres" : "runtime";
    return {
      id: readBadgeKey(kind, label),
      kind,
      label,
      meta: "Service",
    };
  }

  if (normalizedKind === "build" && options?.includeBuild) {
    const label = normalizedName || humanize(normalizedSlug);
    const kind = readBuildBadgeKind(normalizedSlug) ?? "runtime";
    return {
      id: readBadgeKey(kind, label),
      kind,
      label,
      meta: "Build",
    };
  }

  return {
    id: readBadgeKey("runtime", normalizedName || humanize(normalizedSlug)),
    kind: "runtime",
    label: normalizedName || humanize(normalizedSlug),
    meta: humanize(normalizedKind),
  };
}

function buildDetectedStackTech(
  source?: FugueAppSource | null,
): FugueAppTechnology[] {
  const detectedStack = source?.detectedStack?.trim();

  if (!detectedStack) {
    return [];
  }

  return [
    {
      kind: "stack",
      name: readTechnologyLabel(detectedStack) || humanize(detectedStack),
      slug: detectedStack.toLowerCase(),
      source: "detected",
    },
  ];
}

function readDisplayTechStack(app: FugueApp, source?: FugueAppSource | null) {
  const detectedStack = buildDetectedStackTech(source);

  if (detectedStack.length) {
    return detectedStack;
  }

  const pendingCommit = source?.commitSha?.trim() || null;
  const runningCommit = app.source.commitSha?.trim() || null;

  if (!source || !pendingCommit || pendingCommit === runningCommit) {
    return app.techStack;
  }

  return [];
}

function buildSourceBadges(source: FugueAppSource) {
  const detectedStackKind =
    readLanguageBadgeKind(source.detectedStack) ?? "runtime";
  const detectedProviderKind = readLanguageBadgeKind(source.detectedProvider);

  return [
    source.detectedStack
      ? {
          id: readBadgeKey(
            detectedStackKind,
            readTechnologyLabel(source.detectedStack) ||
              humanize(source.detectedStack),
          ),
          kind: detectedStackKind,
          label:
            readTechnologyLabel(source.detectedStack) ||
            humanize(source.detectedStack),
          meta: "Stack",
        }
      : null,
    !source.detectedStack && source.detectedProvider && detectedProviderKind
      ? {
          id: readBadgeKey(
            detectedProviderKind,
            readTechnologyLabel(source.detectedProvider) ||
              humanize(source.detectedProvider),
          ),
          kind: detectedProviderKind,
          label:
            readTechnologyLabel(source.detectedProvider) ||
            humanize(source.detectedProvider),
          meta:
            detectedProviderKind === "nextjs" ||
            detectedProviderKind === "react"
              ? "Stack"
              : "Language",
        }
      : null,
    source.buildStrategy
      ? {
          id: readBadgeKey(
            readBuildBadgeKind(source.buildStrategy) ?? "runtime",
            humanize(source.buildStrategy),
          ),
          kind: readBuildBadgeKind(source.buildStrategy) ?? "runtime",
          label: humanize(source.buildStrategy),
          meta: "Build",
        }
      : null,
  ].filter((badge): badge is ConsoleGalleryBadgeView => Boolean(badge));
}

function readPrimaryBadge(badges: ConsoleGalleryBadgeView[]) {
  return (
    badges.find((badge) => badge.meta === "Stack") ??
    badges.find((badge) => badge.meta === "Language") ??
    badges.find(
      (badge) => badge.kind !== "postgres" && badge.meta !== "Build",
    ) ??
    badges.find((badge) => badge.kind !== "postgres") ??
    badges[0] ??
    null
  );
}

function buildAppBadges(
  app: FugueApp,
  options?: {
    source?: FugueAppSource | null;
    techStack?: FugueAppTechnology[];
  },
): ConsoleGalleryBadgeView[] {
  const displaySource = options?.source ?? app.source;
  const displayTechStack = options?.techStack ?? app.techStack;
  const badges = new Map<string, ConsoleGalleryBadgeView>();
  const sourceBadges = buildSourceBadges(displaySource);
  const sourceLanguageBadge =
    sourceBadges.find(
      (badge) => badge.meta === "Language" || badge.meta === "Stack",
    ) ?? null;
  const sourceBuildBadge =
    sourceBadges.find((badge) => badge.meta === "Build") ?? null;

  const addBadge = (badge: ConsoleGalleryBadgeView | null) => {
    if (!badge || badges.has(badge.id)) {
      return;
    }

    badges.set(badge.id, badge);
  };

  addBadge(sourceLanguageBadge);

  if (displayTechStack.length) {
    for (const item of displayTechStack) {
      const normalizedKind = item.kind.trim().toLowerCase();
      const normalizedSlug = item.slug.trim().toLowerCase();

      if (normalizedKind === "build" || normalizedSlug === "postgres") {
        continue;
      }

      addBadge(buildBadgeFromTechStack(item));
    }
  }

  addBadge(sourceBuildBadge);

  if (!badges.size && displayTechStack.length) {
    for (const item of displayTechStack) {
      if (item.slug.trim().toLowerCase() === "postgres") {
        continue;
      }

      addBadge(buildBadgeFromTechStack(item, { includeBuild: true }));
    }
  }

  if (!badges.size) {
    addBadge({
      id: readBadgeKey("runtime", humanize(displaySource.type)),
      kind: "runtime",
      label: humanize(displaySource.type),
      meta: "Service",
    });
  }

  if (app.backingServices.some((service) => service.type === "postgres")) {
    addBadge({
      id: readBadgeKey("postgres", "PostgreSQL"),
      kind: "postgres",
      label: "PostgreSQL",
      meta: "Service",
    });
  }

  return [...badges.values()].slice(0, 6);
}

function buildPersistentStorageMountView(
  mount: FugueAppPersistentStorageMount,
): ConsoleGalleryPersistentStorageMountView | null {
  const path = mount.path?.trim() ?? "";
  let normalizedKind: ConsoleGalleryPersistentStorageMountView["kind"] = null;

  if (mount.kind === "directory" || mount.kind === "file") {
    normalizedKind = mount.kind;
  }

  if (!path) {
    return null;
  }

  return {
    kind: normalizedKind,
    mode: mount.mode ?? null,
    path,
    seedContent: mount.seedContent ?? null,
    secret: mount.secret ?? false,
  };
}

function buildSharedAppView(
  app: FugueApp,
  options?: {
    currentRuntimeId?: string | null;
    location?: WorkloadLocationView | null;
    runtimeId?: string | null;
    source?: FugueAppSource | null;
    techStack?: FugueAppTechnology[];
  },
) {
  const source = options?.source ?? app.source;
  const techStack = options?.techStack ?? app.techStack;
  const route = readRoute(app);
  const routeHostname = readRouteHostname(app);
  const redeploy = readRedeployState(app);
  const redeployAction = readRedeployAction(app);
  const failoverState = readAppFailoverState(app);
  const sourceBranchLabel = readSourceBranchLabelFromSource(source);
  const serviceBadges = buildAppBadges(app, { source, techStack });
  const persistentStorageMounts =
    app.spec.persistentStorage?.mounts
      .map(buildPersistentStorageMountView)
      .flatMap((mount) => (mount ? [mount] : [])) ?? [];
  const primaryBadge = readPrimaryBadge(serviceBadges) ??
    serviceBadges[0] ?? {
      id: readBadgeKey("runtime", humanize(source.type)),
      kind: "runtime",
      label: humanize(source.type),
      meta: "Service",
    };

  return {
    canRedeploy: redeploy.canRedeploy,
    currentRuntimeId:
      options?.currentRuntimeId ??
      app.status.currentRuntimeId ??
      options?.runtimeId ??
      app.spec.runtimeId ??
      null,
    deployBehavior: readDeployBehavior(app),
    exposesPublicRoute: app.spec.networkMode !== "background",
    failoverAuto: app.spec.failover?.auto ?? false,
    failoverConfigured: Boolean(app.spec.failover),
    failoverState,
    failoverStateTone: toneForAppFailoverState(failoverState),
    failoverTargetRuntimeId: app.spec.failover?.targetRuntimeId ?? null,
    hasManagedPostgresService: app.backingServices.some(
      (service) => isManagedPostgresService(service),
    ),
    hasPersistentWorkspace: Boolean(app.spec.workspace),
    hasPostgresService: app.backingServices.some(
      (service) => service.type === "postgres",
    ),
    id: app.id,
    imageMirrorLimit: app.spec.imageMirrorLimit ?? 1,
    locationCountryCode: options?.location?.locationCountryCode ?? null,
    locationLabel: options?.location?.locationLabel ?? null,
    name: app.name,
    networkMode: app.spec.networkMode ?? null,
    primaryBadge,
    replicaCount: app.spec.replicas ?? null,
    startupCommand: app.spec.startupCommand ?? null,
    redeployActionDescription: redeployAction.description,
    redeployActionLabel: redeployAction.label,
    redeployActionLoadingLabel: redeployAction.loadingLabel,
    redeployQueuedMessage: redeployAction.queuedMessage,
    redeployDisabledReason: redeploy.redeployDisabledReason,
    routeBaseDomain: readAppRouteBaseDomain(app),
    routeHref: route.href,
    routeHostname,
    routeLabel: route.label,
    routePublicUrl: app.route.publicUrl?.trim() || null,
    runtimeId: options?.runtimeId ?? app.spec.runtimeId ?? null,
    serviceBadges,
    sourceBranchHref:
      sourceBranchLabel && sourceBranchLabel !== "Default branch"
        ? readGitHubBranchHref(source.repoUrl, source.repoBranch)
        : null,
    sourceBranchLabel,
    sourceBranchName: source.repoBranch?.trim() || null,
    sourceHref: readFugueSourceHref(source),
    sourceLabel: readSourceLabelFromSource(source),
    sourceMeta: readFugueSourceMeta(source),
    sourceType: source.type,
    persistentStorageMounts,
    persistentStorageStorageClassName:
      app.spec.persistentStorage?.storageClassName ?? null,
    persistentStorageStorageSize:
      app.spec.persistentStorage?.storageSize ?? null,
  } satisfies Omit<
    ConsoleGalleryAppView,
    | "buildLogsOperationId"
    | "commitViews"
    | "currentCommitCommittedAt"
    | "currentCommitExact"
    | "currentCommitHref"
    | "currentCommitLabel"
    | "lastMessage"
    | "phase"
    | "phaseTone"
    | "preferredLogsMode"
    | "serviceDurationLabel"
    | "serviceRole"
  >;
}

function buildAppView(
  app: FugueApp,
  commitOperations?: AppCommitOperations,
  location?: WorkloadLocationView | null,
  runtimeLocationsById: ReadonlyMap<string, RuntimeTargetLocationView> = new Map(),
  options?: {
    hasLiveDatabaseContinuityTransition?: boolean;
  },
): ConsoleGalleryAppView[] {
  const rawActiveOperation = readActiveReleaseOperation(
    commitOperations?.active ?? null,
    app,
  );
  // Database continuity toggles currently flow through app-scoped deploy
  // operations. Keep that op on the database card, but avoid inventing a
  // second app release card when the app itself is unchanged.
  const continuityOnlyDeploy = isDatabaseContinuityOnlyDeployOperation(
    app,
    rawActiveOperation,
    options?.hasLiveDatabaseContinuityTransition ?? false,
  );
  const activeOperation = continuityOnlyDeploy ? null : rawActiveOperation;
  const commitViews = buildCommitViews(app, activeOperation);
  const runningBuildLogsOperation = readRunningBuildLogsOperation(
    app,
    commitOperations,
  );
  const pendingBuildLogsOperation = activeOperation
    ? readPendingBuildLogsOperation(activeOperation, commitOperations)
    : null;
  const activePhase = activeOperation
    ? readPendingCommitState(activeOperation)
    : null;
  const primaryCommit =
    commitViews.find((entry) => entry.kind === "running") ??
    commitViews[0] ??
    null;
  const currentCommitLabel =
    primaryCommit?.label ??
    (isGitHubSource(app) ? readCurrentCommitLabel(app) : null);
  const fallbackPhase =
    continuityOnlyDeploy && hasLiveRelease(app)
      ? "running"
      : (app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown"));
  const runningReleaseStatus = readRunningReleaseStatus(
    app,
    fallbackPhase,
    activeOperation,
  );
  const runningFailureSummary = isTerminalAppFailurePhase(app.status.phase)
    ? readReleaseFailureSummary(commitOperations)
    : null;
  const pendingRuntimeId =
    activeOperation && isTransferOperation(activeOperation)
      ? activeOperation.targetRuntimeId?.trim() || null
      : null;
  const pendingLocation =
    pendingRuntimeId !== null
      ? readRuntimeTargetLocationView(runtimeLocationsById, pendingRuntimeId)
      : location;
  const sharedView = buildSharedAppView(app, { location });
  const pendingSharedView = activeOperation
    ? buildSharedAppView(app, {
        currentRuntimeId: pendingRuntimeId,
        location: pendingLocation,
        runtimeId: pendingRuntimeId,
        source: activeOperation.desiredSource,
        techStack: readDisplayTechStack(app, activeOperation.desiredSource),
      })
    : null;

  const runningView =
    hasLiveRelease(app) || !activeOperation
      ? ({
          ...sharedView,
          buildLogsOperationId: runningBuildLogsOperation?.id ?? null,
          commitViews,
          currentCommitCommittedAt: primaryCommit?.committedAt ?? null,
          currentCommitExact: primaryCommit?.exact ?? null,
          currentCommitHref: primaryCommit?.href ?? null,
          currentCommitLabel,
          lastMessage:
            continuityOnlyDeploy && hasLiveRelease(app)
              ? "Current release is serving traffic."
              : readRunningServiceMessage(app, commitOperations, activeOperation),
          phase: runningReleaseStatus.phase,
          phaseTone: runningReleaseStatus.tone,
          preferredLogsMode: runningFailureSummary?.logsMode ?? "build",
          serviceDurationLabel: null,
          serviceRole: "running",
        } satisfies ConsoleGalleryAppView)
      : null;

  const pendingView =
    activeOperation && activePhase
      ? ({
          ...(pendingSharedView ?? sharedView),
          buildLogsOperationId: pendingBuildLogsOperation?.id ?? null,
          commitViews,
          currentCommitCommittedAt: primaryCommit?.committedAt ?? null,
          currentCommitExact: primaryCommit?.exact ?? null,
          currentCommitHref: primaryCommit?.href ?? null,
          currentCommitLabel,
          lastMessage: readPendingServiceMessage(app, activeOperation),
          phase: activePhase.stateLabel,
          phaseTone: activePhase.tone,
          preferredLogsMode: "build",
          serviceDurationLabel: formatElapsedDuration(
            readOperationStartedAt(activeOperation),
          ),
          serviceRole: "pending",
        } satisfies ConsoleGalleryAppView)
      : null;

  const views: ConsoleGalleryAppView[] = [];

  if (runningView) {
    views.push(runningView);
  }

  if (pendingView) {
    views.push(pendingView);
  }

  return views;
}

function buildBackingServiceViews(
  service: FugueBackingService,
  appNames: Map<string, string>,
  appRuntimeIds: Map<string, string | null>,
  appFailoverStates: Map<string, ConsoleGalleryAppView["failoverState"]>,
  runtimeLocationsById: ReadonlyMap<string, RuntimeTargetLocationView>,
  location?: WorkloadLocationView | null,
  databaseTransferOperation?: FugueOperation | null,
  databaseContinuityOperation?: FugueOperation | null,
): ConsoleGalleryBackingServiceView[] {
  const postgres = service.spec.postgres;
  const ownerAppRuntimeId = service.ownerAppId
    ? (appRuntimeIds.get(service.ownerAppId) ?? null)
    : null;
  const ownerAppFailoverState = service.ownerAppId
    ? (appFailoverStates.get(service.ownerAppId) ?? "off")
    : "off";
  const databaseRuntimeId = postgres?.runtimeId ?? ownerAppRuntimeId ?? null;
  const databaseTransferTargetRuntimeId =
    databaseTransferOperation?.targetRuntimeId?.trim() || null;
  const databaseFailoverTargetRuntimeId =
    postgres?.failoverTargetRuntimeId ?? null;
  const databaseInstances = postgres?.instances ?? null;
  const databaseSynchronousReplicas = postgres?.synchronousReplicas ?? null;
  const databaseFailoverConfigured = Boolean(
    databaseFailoverTargetRuntimeId ||
    ((databaseInstances ?? 0) > 1 && (databaseSynchronousReplicas ?? 0) > 0),
  );
  const databaseContinuity = readDatabaseContinuityView(
    service,
    databaseContinuityOperation,
    ownerAppFailoverState,
  );
  const ownerAppLabel = service.ownerAppId
    ? (appNames.get(service.ownerAppId) ?? "Attached app")
    : "Attached app";
  const primaryBadge = {
    id: readBadgeKey("postgres", "PostgreSQL"),
    kind: "postgres",
    label: "PostgreSQL",
    meta: "Service",
  } satisfies ConsoleGalleryBackingServiceView["primaryBadge"];
  const runningView = {
    databaseContinuity,
    databaseFailoverConfigured,
    databaseFailoverTargetRuntimeId,
    databaseInstances,
    databaseRuntimeId,
    databaseSynchronousReplicas,
    databaseTransferTargetRuntimeId,
    description: postgres
      ? databaseTransferTargetRuntimeId
        ? "Serving writes from the current primary while Fugue prepares the destination."
        : readDatabaseContinuityDescription(databaseContinuity)
      : (service.description ?? "Attached backing service."),
    id: service.id,
    locationCountryCode: location?.locationCountryCode ?? null,
    locationLabel: location?.locationLabel ?? null,
    name: service.name,
    ownerAppId: service.ownerAppId,
    ownerAppLabel,
    primaryBadge,
    serviceDurationLabel: null,
    serviceRole: "running",
    status: humanize(service.status),
    statusTone: toneForStatus(service.status),
    type: humanize(service.type),
  } satisfies ConsoleGalleryBackingServiceView;

  if (
    !databaseTransferOperation ||
    !databaseTransferTargetRuntimeId ||
    databaseTransferTargetRuntimeId === databaseRuntimeId
  ) {
    return [runningView];
  }

  const pendingLocation =
    readRuntimeTargetLocationView(
      runtimeLocationsById,
      databaseTransferTargetRuntimeId,
    ) ?? location;
  const transferState = readDatabaseTransferState(databaseTransferOperation);

  return [
    runningView,
    {
      ...runningView,
      description: transferState.description,
      locationCountryCode: pendingLocation?.locationCountryCode ?? null,
      locationLabel: pendingLocation?.locationLabel ?? null,
      serviceDurationLabel: formatElapsedDuration(
        readOperationStartedAt(databaseTransferOperation),
      ),
      serviceRole: "pending",
      status: transferState.status,
      statusTone: transferState.tone,
    },
  ];
}

function buildProjectServiceBadges(
  services: ConsoleGalleryProjectView["services"],
): ConsoleGalleryBadgeView[] {
  const badges = new Map<string, ConsoleGalleryBadgeView>();

  for (const service of services) {
    const key =
      service.kind === "app"
        ? `project-service:app:${service.id}`
        : `project-service:${service.kind}:${service.id}`;

    if (
      service.kind === "app" &&
      service.serviceRole === "pending" &&
      badges.has(key)
    ) {
      continue;
    }

    badges.set(key, {
      ...service.primaryBadge,
      id: key,
    });
  }

  return [...badges.values()];
}

function projectNameMap(
  projects: FugueProject[],
  fallbackId?: string | null,
  fallbackName?: string | null,
) {
  const names = new Map<string, string>(
    projects.map((project) => [project.id, project.name] as const),
  );

  if (fallbackId && fallbackName && !names.has(fallbackId)) {
    names.set(fallbackId, fallbackName);
  }

  return names;
}

function buildImportRuntimeTargetView(
  runtime: FugueRuntime,
  workspaceTenantId: string,
  fallbackLocation?: RuntimeTargetLocationView | null,
  locale: Locale = "en",
): ConsoleImportRuntimeTargetView {
  const runtimeLocation = readRuntimeLocation(runtime.labels, locale);
  const shouldUseFallbackLocation =
    runtime.type !== "managed-shared" ||
    runtime.id !== DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID ||
    hasInternalClusterLocationTarget(runtime.labels);
  const location = {
    ...runtimeLocation,
    locationCountryCode:
      runtimeLocation.locationCountryCode ??
      (shouldUseFallbackLocation
        ? fallbackLocation?.locationCountryCode
        : null) ??
      null,
    locationCountryLabel:
      runtimeLocation.locationCountryLabel ??
      (shouldUseFallbackLocation
        ? fallbackLocation?.locationCountryLabel
        : null) ??
      null,
    locationLabel:
      runtimeLocation.locationLabel ??
      (shouldUseFallbackLocation ? fallbackLocation?.locationLabel : null) ??
      null,
  };
  const statusLabel = runtime.status ? translate(locale, humanize(runtime.status)) : null;
  const statusTone = runtime.status ? toneForStatus(runtime.status) : null;

  if (runtime.type === "managed-shared") {
    const isGenericInternalCluster =
      runtime.id === DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID &&
      !hasInternalClusterLocationTarget(runtime.labels);
    const primaryLabel = isGenericInternalCluster
      ? translate(locale, "Any available region")
      : (location.locationCountryLabel ??
        location.locationLabel ??
        translate(locale, "Region unavailable"));

    return {
      category: "internal-cluster",
      description:
        !isGenericInternalCluster && location.hasPlacementConstraint
          ? translate(locale, "Use shared capacity in this region.")
          : translate(locale, "Deploy onto the internal cluster."),
      id: runtime.id,
      kindLabel: translate(locale, "Internal cluster"),
      locationCountryCode: location.locationCountryCode,
      locationCountryLabel: location.locationCountryLabel,
      locationLabel: isGenericInternalCluster ? null : location.locationLabel,
      primaryLabel,
      runtimeType: runtime.type ?? null,
      statusLabel,
      statusTone,
      summaryLabel: `${translate(locale, "Internal cluster")} / ${primaryLabel}`,
    };
  }

  const primaryLabel =
    runtime.name?.trim() || runtime.machineName?.trim() || shortId(runtime.id);
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
      ? translate(locale, "Deploy onto a machine shared with this workspace.")
      : isContributedMachine
        ? translate(
            locale,
            "Deploy onto this machine. It also contributes to the internal cluster.",
          )
        : translate(locale, "Deploy onto this machine."),
    id: runtime.id,
    kindLabel: isSharedMachine
      ? translate(locale, "Shared machine")
      : translate(locale, "Machine"),
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

function compareImportRuntimeTargets(
  left: ConsoleImportRuntimeTargetView,
  right: ConsoleImportRuntimeTargetView,
) {
  if (left.category !== right.category) {
    return left.category === "internal-cluster" ? -1 : 1;
  }

  const leftIsDefaultShared = left.id === "runtime_managed_shared";
  const rightIsDefaultShared = right.id === "runtime_managed_shared";

  if (leftIsDefaultShared !== rightIsDefaultShared) {
    return leftIsDefaultShared ? -1 : 1;
  }

  const primaryLabelComparison = left.primaryLabel.localeCompare(
    right.primaryLabel,
    "en",
    {
      sensitivity: "base",
    },
  );

  if (primaryLabelComparison !== 0) {
    return primaryLabelComparison;
  }

  const locationLabelComparison = (left.locationLabel ?? "").localeCompare(
    right.locationLabel ?? "",
    "en",
    {
      sensitivity: "base",
    },
  );

  if (locationLabelComparison !== 0) {
    return locationLabelComparison;
  }

  return left.id.localeCompare(right.id, "en", { sensitivity: "base" });
}

function normalizeProjectLifecycleSyncMode(
  value?: string | null,
): ConsoleProjectLifecycleView["syncMode"] {
  switch (value?.trim().toLowerCase()) {
    case "active":
      return "active";
    case "passive":
      return "passive";
    default:
      return "idle";
  }
}

function buildConsoleProjectSummaryBadgeView(
  badge: FugueConsoleProjectSummary["serviceBadges"][number],
): ConsoleGalleryBadgeView {
  const kind = (badge.kind?.trim() || "runtime") as ConsoleGalleryBadgeKind;
  const label = badge.label?.trim() || "Unknown";
  const meta = badge.meta?.trim() || "Service";

  return {
    id: readBadgeKey(kind, `${label}:${meta}`),
    kind,
    label,
    meta,
  };
}

function buildConsoleProjectSummaryView(
  project: FugueConsoleProjectSummary,
): ConsoleProjectSummaryView {
  const resourceUsageSnapshot = {
    cpuMillicores: project.resourceUsageSnapshot.cpuMillicores ?? null,
    ephemeralStorageBytes:
      project.resourceUsageSnapshot.ephemeralStorageBytes ?? null,
    memoryBytes: project.resourceUsageSnapshot.memoryBytes ?? null,
  } satisfies ConsoleProjectResourceUsageSnapshot;

  return {
    appCount: project.appCount,
    id: project.id,
    lifecycle: {
      label: project.lifecycle.label,
      live: project.lifecycle.live,
      syncMode: normalizeProjectLifecycleSyncMode(project.lifecycle.syncMode),
      tone: readProjectLifecycleTone(
        project.lifecycle.label,
        project.lifecycle.tone,
      ),
    },
    name: project.name,
    resourceUsage: buildProjectResourceUsageView(resourceUsageSnapshot),
    resourceUsageSnapshot,
    serviceBadges: (project.serviceBadges ?? []).map(
      buildConsoleProjectSummaryBadgeView,
    ),
    serviceCount: project.serviceCount,
  };
}

function buildConsoleProjectViewFromDetail(
  detail: FugueConsoleProjectDetail,
): ConsoleGalleryProjectView {
  const sortedApps = sortByTimestampDesc(detail.apps, readAppTimestamp);
  const appNames = new Map(
    sortedApps.map((app) => [app.id, app.name] as const),
  );
  const appRuntimeIds = new Map(
    sortedApps.map(
      (app) =>
        [
          app.id,
          app.spec.runtimeId ?? app.status.currentRuntimeId ?? null,
        ] as const,
    ),
  );
  const appFailoverStates = new Map(
    sortedApps.map(
      (app) => [app.id, readAppFailoverState(app)] as const,
    ),
  );
  const commitOperationsByAppId = collectCommitOperationsByAppId(
    detail.operations,
  );
  const databaseTransferOperationsByAppId =
    collectDatabaseTransferOperationsByAppId(detail.operations);
  const databaseContinuityOperationsByAppId =
    collectDatabaseContinuityOperationsByAppId(detail.operations);
  const workloadLocationsById = buildWorkloadLocationMap(detail.clusterNodes);
  const runtimeLocationsById = buildRuntimeTargetLocationMap(detail.clusterNodes);
  const backingServicesById = new Map<string, FugueBackingService>();

  for (const app of sortedApps) {
    for (const service of app.backingServices) {
      backingServicesById.set(service.id, service);
    }
  }

  const backingServices = sortByTimestampDesc(
    [...backingServicesById.values()],
    readServiceTimestamp,
  );
  const appsWithLiveDatabaseContinuityTransition =
    collectAppsWithLiveDatabaseContinuityTransition(
      backingServices,
      databaseContinuityOperationsByAppId,
    );
  const resourceUsage = sumCurrentResourceUsage([
    ...sortedApps.map((app) => app.currentResourceUsage),
    ...backingServices.map((service) => service.currentResourceUsage),
  ]);
  const resourceUsageSnapshot = {
    cpuMillicores: resourceUsage.cpuMillicores ?? null,
    ephemeralStorageBytes: resourceUsage.ephemeralStorageBytes ?? null,
    memoryBytes: resourceUsage.memoryBytes ?? null,
  } satisfies ConsoleProjectResourceUsageSnapshot;
  const appViews = sortedApps.flatMap((app) =>
    buildAppView(
      app,
      commitOperationsByAppId.get(app.id),
      workloadLocationsById.get(app.id) ?? null,
      runtimeLocationsById,
      {
        hasLiveDatabaseContinuityTransition:
          appsWithLiveDatabaseContinuityTransition.has(app.id),
      },
    ).map((service) => ({
      kind: "app" as const,
      ...service,
    })),
  );
  const backingServiceViews = backingServices.flatMap((service) =>
    buildBackingServiceViews(
      service,
      appNames,
      appRuntimeIds,
      appFailoverStates,
      runtimeLocationsById,
        workloadLocationsById.get(service.id) ?? null,
        service.ownerAppId
          ? (databaseTransferOperationsByAppId.get(service.ownerAppId) ?? null)
          : null,
        service.ownerAppId
          ? (databaseContinuityOperationsByAppId.get(service.ownerAppId) ??
            null)
          : null,
      ).map((view) => ({
        kind: "backing-service" as const,
        ...view,
    })),
  );
  const services = [...appViews, ...backingServiceViews];

  return {
    appCount: sortedApps.length,
    id: detail.projectId,
    name: detail.project?.name ?? detail.projectName,
    resourceUsage: buildProjectResourceUsageView(resourceUsage),
    resourceUsageSnapshot,
    serviceBadges: buildProjectServiceBadges(services),
    serviceCount: services.length,
    services,
  };
}

async function requestWithWorkspaceRefresh<T>(
  workspace: WorkspaceAccess,
  request: (workspace: WorkspaceAccess) => Promise<T>,
) {
  try {
    return await request(workspace);
  } catch (error) {
    if (!isUnauthorizedFugueError(error)) {
      throw error;
    }

    const session = await getRequestSession();

    if (!session) {
      throw error;
    }

    const refreshed = await ensureWorkspaceAccess(session);
    return request(refreshed.workspace);
  }
}

const getConsoleProjectGallerySummaryDataCached = cache(async () => {
  const workspace = await getCurrentWorkspaceAccess();

  if (!workspace) {
    return {
      errors: [],
      projects: [],
      workspace: {
        exists: false,
        stage: "needs-workspace",
      },
    } satisfies ConsoleProjectGallerySummaryData;
  }

  try {
    const gallery = await requestWithWorkspaceRefresh(workspace, (active) =>
      getFugueConsoleGallery(active.adminKeySecret),
    );

    return {
      errors: [],
      projects: gallery.projects.map(buildConsoleProjectSummaryView),
      workspace: {
        exists: true,
        stage: gallery.projects.length > 0 ? "ready" : "empty",
      },
    } satisfies ConsoleProjectGallerySummaryData;
  } catch (error) {
    return {
      errors: [`projects: ${readErrorMessage(error)}`],
      projects: [],
      workspace: {
        exists: true,
        stage: "empty",
      },
    } satisfies ConsoleProjectGallerySummaryData;
  }
});

async function loadRuntimeInventoryData(
  workspace: WorkspaceAccess,
  locale: Locale = "en",
): Promise<ConsoleRuntimeTargetInventoryData> {
  const loadInventory = (active: WorkspaceAccess) =>
    Promise.allSettled([
      getFugueRuntimes(active.adminKeySecret, {
        syncLocations: false,
      }),
      getFugueClusterNodes(active.adminKeySecret, {
        syncLocations: false,
      }),
    ]);

  let [runtimesResult, clusterNodesResult] = await loadInventory(workspace);

  if (
    runtimesResult.status === "rejected" &&
    clusterNodesResult.status === "rejected" &&
    isUnauthorizedFugueError(runtimesResult.reason) &&
    isUnauthorizedFugueError(clusterNodesResult.reason)
  ) {
    const session = await getRequestSession();

    if (session) {
      const refreshed = await ensureWorkspaceAccess(session);
      [runtimesResult, clusterNodesResult] = await loadInventory(
        refreshed.workspace,
      );
    }
  }

  const clusterNodes =
    clusterNodesResult.status === "fulfilled" ? clusterNodesResult.value : [];
  const runtimeTargetLocationsByRuntimeId =
    buildRuntimeTargetLocationMap(clusterNodes, locale);
  const runtimeTargetInventoryError =
    runtimesResult.status === "rejected"
      ? readErrorMessage(runtimesResult.reason)
      : null;
  const runtimeTargets =
    runtimesResult.status === "fulfilled"
      ? [...runtimesResult.value]
          .map((runtime) =>
            buildImportRuntimeTargetView(
              runtime,
              workspace.tenantId,
              runtimeTargetLocationsByRuntimeId.get(runtime.id) ?? null,
              locale,
            ),
          )
          .sort(compareImportRuntimeTargets)
      : [];

  return {
    runtimeTargetInventoryError,
    runtimeTargets,
  };
}

const getConsoleProjectGalleryDataCached = cache(
  async (includeProjectImageUsage: boolean, includeRuntimeTargets: boolean) => {
    const initialWorkspace = await getCurrentWorkspaceAccess();

    if (!initialWorkspace) {
      return {
        errors: [],
        projects: [],
        runtimeTargetInventoryError: null,
        runtimeTargets: [],
        workspace: {
          exists: false,
          stage: "needs-workspace",
        },
      } satisfies ConsoleProjectGalleryData;
    }

    async function loadWorkspaceData(workspace: WorkspaceAccess) {
      return Promise.allSettled([
        getFugueProjects(
          workspace.adminKeySecret,
          workspace.tenantId ?? undefined,
        ),
        getFugueApps(workspace.adminKeySecret, {
          includeLiveStatus: false,
          includeResourceUsage: false,
        }),
        getFugueOperations(workspace.adminKeySecret),
        getFugueClusterNodes(workspace.adminKeySecret, {
          syncLocations: false,
        }),
        includeRuntimeTargets
          ? getFugueRuntimes(workspace.adminKeySecret, {
              syncLocations: false,
            })
          : Promise.resolve(null),
        includeProjectImageUsage
          ? getFugueProjectImageUsage(workspace.adminKeySecret)
          : Promise.resolve(null),
      ]);
    }

    let workspace = initialWorkspace;
    let [
      projectsResult,
      appsResult,
      operationsResult,
      clusterNodesResult,
      runtimesResult,
      projectImageUsageResult,
    ] = await loadWorkspaceData(workspace);

    const shouldRetryRuntimeTargets =
      !includeRuntimeTargets ||
      (runtimesResult.status === "rejected" &&
        isUnauthorizedFugueError(runtimesResult.reason));
    const shouldRetryProjectImageUsage =
      !includeProjectImageUsage ||
      (projectImageUsageResult.status === "rejected" &&
        isUnauthorizedFugueError(projectImageUsageResult.reason));

    if (
      projectsResult.status === "rejected" &&
      appsResult.status === "rejected" &&
      operationsResult.status === "rejected" &&
      shouldRetryRuntimeTargets &&
      shouldRetryProjectImageUsage &&
      isUnauthorizedFugueError(projectsResult.reason) &&
      isUnauthorizedFugueError(appsResult.reason) &&
      isUnauthorizedFugueError(operationsResult.reason)
    ) {
      const session = await getRequestSession();

      if (session) {
        try {
          const refreshed = await ensureWorkspaceAccess(session);
          workspace = refreshed.workspace;
          [
            projectsResult,
            appsResult,
            operationsResult,
            clusterNodesResult,
            runtimesResult,
            projectImageUsageResult,
          ] = await loadWorkspaceData(workspace);
        } catch {
          // Keep the original 401 results when recovery fails.
        }
      }
    }

    const errors = [
      projectsResult.status === "rejected"
        ? `projects: ${readErrorMessage(projectsResult.reason)}`
        : null,
      appsResult.status === "rejected"
        ? `apps: ${readErrorMessage(appsResult.reason)}`
        : null,
      operationsResult.status === "rejected"
        ? `operations: ${readErrorMessage(operationsResult.reason)}`
        : null,
      clusterNodesResult.status === "rejected"
        ? `cluster nodes: ${readErrorMessage(clusterNodesResult.reason)}`
        : null,
      includeProjectImageUsage && projectImageUsageResult.status === "rejected"
        ? `project image usage: ${readErrorMessage(projectImageUsageResult.reason)}`
        : null,
    ].filter((value): value is string => Boolean(value));

    const projects =
      projectsResult.status === "fulfilled" ? projectsResult.value : [];
    const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
    const operations =
      operationsResult.status === "fulfilled" ? operationsResult.value : [];
    const clusterNodes =
      clusterNodesResult.status === "fulfilled" ? clusterNodesResult.value : [];
    const projectImageUsage =
      projectImageUsageResult.status === "fulfilled"
        ? projectImageUsageResult.value
        : null;
    const projectImageUsageByProjectId = new Map(
      (projectImageUsage?.projects ?? []).map(
        (summary) => [summary.projectId, summary] as const,
      ),
    );
    const runtimeTargetLocationsByRuntimeId =
      buildRuntimeTargetLocationMap(clusterNodes);
    const runtimeTargetInventoryError =
      includeRuntimeTargets && runtimesResult.status === "rejected"
        ? readErrorMessage(runtimesResult.reason)
        : null;
    const runtimeTargets =
      includeRuntimeTargets && runtimesResult.status === "fulfilled"
        ? [...(runtimesResult.value ?? [])]
            .map((runtime) =>
              buildImportRuntimeTargetView(
                runtime,
                workspace.tenantId,
                runtimeTargetLocationsByRuntimeId.get(runtime.id) ?? null,
              ),
            )
            .sort(compareImportRuntimeTargets)
        : [];
    const namesByProjectId = projectNameMap(
      projects,
      workspace.defaultProjectId,
      workspace.defaultProjectName,
    );
    const commitOperationsByAppId = collectCommitOperationsByAppId(operations);
    const databaseTransferOperationsByAppId =
      collectDatabaseTransferOperationsByAppId(operations);
    const databaseContinuityOperationsByAppId =
      collectDatabaseContinuityOperationsByAppId(operations);
    const workloadLocationsById = buildWorkloadLocationMap(clusterNodes);
    const runtimeTargetLocationsById =
      buildRuntimeTargetLocationMap(clusterNodes);
    const appsByProjectId = new Map<string, FugueApp[]>();

    for (const app of apps) {
      const projectId = app.projectId ?? "unassigned";
      const bucket = appsByProjectId.get(projectId) ?? [];
      bucket.push(app);
      appsByProjectId.set(projectId, bucket);
    }

    const projectsById = new Map(
      projects.map((project) => [project.id, project] as const),
    );
    const projectIds = [
      ...new Set([
        ...projects.map((project) => project.id),
        ...appsByProjectId.keys(),
      ]),
    ];

    const projectViews = projectIds
      .map((projectId) => {
        const project = projectsById.get(projectId) ?? null;
        const projectApps = appsByProjectId.get(projectId) ?? [];
        const sortedApps = sortByTimestampDesc(projectApps, readAppTimestamp);
        const appNames = new Map(
          sortedApps.map((app) => [app.id, app.name] as const),
        );
        const appRuntimeIds = new Map(
          sortedApps.map(
            (app) =>
              [
                app.id,
                app.spec.runtimeId ?? app.status.currentRuntimeId ?? null,
              ] as const,
          ),
        );
        const appFailoverStates = new Map(
          sortedApps.map(
            (app) => [app.id, readAppFailoverState(app)] as const,
          ),
        );
        const backingServicesById = new Map<string, FugueBackingService>();

        for (const app of sortedApps) {
          for (const service of app.backingServices) {
            backingServicesById.set(service.id, service);
          }
        }

        const backingServices = sortByTimestampDesc(
          [...backingServicesById.values()],
          readServiceTimestamp,
        );
        const appsWithLiveDatabaseContinuityTransition =
          collectAppsWithLiveDatabaseContinuityTransition(
            backingServices,
            databaseContinuityOperationsByAppId,
          );
        const resourceUsage = sumCurrentResourceUsage([
          ...sortedApps.map((app) => app.currentResourceUsage),
          ...backingServices.map((service) => service.currentResourceUsage),
        ]);
        const resourceUsageSnapshot = {
          cpuMillicores: resourceUsage.cpuMillicores ?? null,
          ephemeralStorageBytes: resourceUsage.ephemeralStorageBytes ?? null,
          memoryBytes: resourceUsage.memoryBytes ?? null,
        } satisfies ConsoleProjectResourceUsageSnapshot;
        const appViews = sortedApps.flatMap((app) =>
          buildAppView(
            app,
            commitOperationsByAppId.get(app.id),
            workloadLocationsById.get(app.id) ?? null,
            runtimeTargetLocationsById,
            {
              hasLiveDatabaseContinuityTransition:
                appsWithLiveDatabaseContinuityTransition.has(app.id),
            },
          ).map((service) => ({
            kind: "app" as const,
            ...service,
          })),
        );
        const backingServiceViews = backingServices.flatMap((service) =>
          buildBackingServiceViews(
            service,
            appNames,
            appRuntimeIds,
            appFailoverStates,
            runtimeTargetLocationsById,
            workloadLocationsById.get(service.id) ?? null,
            service.ownerAppId
              ? (databaseTransferOperationsByAppId.get(service.ownerAppId) ??
                null)
              : null,
            service.ownerAppId
              ? (databaseContinuityOperationsByAppId.get(service.ownerAppId) ??
                null)
              : null,
          ).map((view) => ({
            kind: "backing-service" as const,
            ...view,
          })),
        );
        const services = [...appViews, ...backingServiceViews];
        const sortTimestamp =
          project !== null
            ? readProjectCreationTimestamp(project)
            : readDerivedProjectCreationTimestamp(sortedApps, backingServices);

        return {
          appCount: sortedApps.length,
          id: projectId,
          name:
            namesByProjectId.get(projectId) ??
            project?.name ??
            (projectId === "unassigned" ? "Unassigned" : humanize(projectId)),
          resourceUsage: buildProjectResourceUsageView(
            resourceUsage,
            projectImageUsageByProjectId.get(projectId) ?? null,
          ),
          resourceUsageSnapshot,
          serviceBadges: buildProjectServiceBadges(services),
          serviceCount: services.length,
          services,
          sortTimestamp,
        };
      })
      // Keep project cards anchored by creation order so status polls do not
      // reshuffle interactive rows while someone is clicking inside the list.
      .sort(
        (left, right) =>
          right.sortTimestamp - left.sortTimestamp ||
          left.id.localeCompare(right.id),
      )
      .map(
        ({ sortTimestamp: _sortTimestamp, ...project }) =>
          project as ConsoleGalleryProjectView,
      );

    return {
      errors,
      projects: projectViews,
      runtimeTargetInventoryError,
      runtimeTargets,
      workspace: {
        exists: true,
        stage: projectViews.length > 0 ? "ready" : "empty",
      },
    } satisfies ConsoleProjectGalleryData;
  },
);

export async function getConsoleProjectGalleryData(options?: {
  includeProjectImageUsage?: boolean;
  includeRuntimeTargets?: boolean;
}) {
  return getConsoleProjectGalleryDataCached(
    options?.includeProjectImageUsage ?? true,
    options?.includeRuntimeTargets ?? true,
  );
}

export async function getConsoleProjectGallerySummaryData() {
  return getConsoleProjectGallerySummaryDataCached();
}

function buildConsoleProjectGalleryUsageData(
  apps: FugueApp[],
): ConsoleProjectGalleryUsageData {
  const usageByProjectId = new Map<
    string,
    Array<FugueResourceUsage | null | undefined>
  >();

  for (const app of apps) {
    const projectID = app.projectId?.trim() || "unassigned";
    const items = usageByProjectId.get(projectID) ?? [];
    items.push(app.currentResourceUsage);

    for (const service of app.backingServices) {
      items.push(service.currentResourceUsage);
    }

    usageByProjectId.set(projectID, items);
  }

  return {
    projects: [...usageByProjectId.entries()].map(([id, items]) => {
      const usage = sumCurrentResourceUsage(items);

      return {
        id,
        resourceUsageSnapshot: {
          cpuMillicores: usage.cpuMillicores ?? null,
          ephemeralStorageBytes: usage.ephemeralStorageBytes ?? null,
          memoryBytes: usage.memoryBytes ?? null,
        },
      };
    }),
  };
}

export async function getConsoleProjectGalleryUsageDataForWorkspace(
  workspace: WorkspaceAccess,
) {
  return consoleProjectGalleryUsageCache.getOrLoad(workspace.tenantId, () =>
    requestWithWorkspaceRefresh(workspace, (active) =>
      getFugueApps(active.adminKeySecret, {
        includeLiveStatus: false,
        includeResourceUsage: true,
      }),
    ).then(buildConsoleProjectGalleryUsageData),
  );
}

export async function getConsoleProjectGalleryUsageData() {
  const workspace = await getCurrentWorkspaceAccess();

  if (!workspace) {
    return {
      projects: [],
    } satisfies ConsoleProjectGalleryUsageData;
  }

  return getConsoleProjectGalleryUsageDataForWorkspace(workspace);
}

export async function getConsoleProjectDetailData(
  projectId: string,
): Promise<ConsoleProjectDetailData> {
  const workspace = await getCurrentWorkspaceAccess();

  if (!workspace) {
    return {
      project: null,
    };
  }

  const detail = await requestWithWorkspaceRefresh(workspace, (active) =>
    getFugueConsoleProject(active.adminKeySecret, projectId),
  );

  return {
    project: buildConsoleProjectViewFromDetail(detail),
  };
}

export async function getConsoleRuntimeTargetInventoryData(
  locale: Locale = "en",
) {
  const workspace = await getCurrentWorkspaceAccess();

  if (!workspace) {
    return {
      runtimeTargetInventoryError: null,
      runtimeTargets: [],
    } satisfies ConsoleRuntimeTargetInventoryData;
  }

  return loadRuntimeInventoryData(workspace, locale);
}
