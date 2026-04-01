import "server-only";

import { cache } from "react";

import { getCurrentSession } from "@/lib/auth/session";
import type { ConsoleTone } from "@/lib/console/types";
import type {
  ConsoleGalleryAppView,
  ConsoleGalleryBadgeKind,
  ConsoleGalleryBadgeView,
  ConsoleGalleryBackingServiceView,
  ConsoleGalleryCommitView,
  ConsoleCompactResourceItemView,
  ConsoleGalleryProjectView,
  ConsoleImportRuntimeTargetView,
  ConsoleProjectGalleryData,
} from "@/lib/console/gallery-types";
import {
  getFugueApps,
  getFugueClusterNodes,
  getFugueOperations,
  getFugueProjects,
  getFugueRuntimes,
  type FugueApp,
  type FugueAppSource,
  type FugueBackingService,
  type FugueClusterNode,
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

type RuntimeTargetLocationView = {
  locationCountryCode: string | null;
  locationCountryLabel: string | null;
  locationLabel: string | null;
};

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

function formatCompactNumber(value: number, digits = 1) {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });

  return formatter.format(value);
}

function formatBytesLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "No stats";
  }

  const units = ["bytes", "KB", "MB", "GB", "TB", "PB"];
  let amount = value;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  const digits = amount >= 100 || unitIndex === 0 ? 0 : 1;

  if (unitIndex === 0) {
    const rounded = Math.round(amount);
    return `${rounded} ${rounded === 1 ? "byte" : "bytes"}`;
  }

  return `${formatCompactNumber(amount, digits)} ${units[unitIndex]}`;
}

function formatCPUMillicoresLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "No stats";
  }

  if (Math.abs(value) >= 1000) {
    const cores = value / 1000;
    return `${formatCompactNumber(cores, 1)} ${cores === 1 ? "core" : "cores"}`;
  }

  return `${Math.round(value)} millicores`;
}

function sumCurrentResourceUsage(items: Array<FugueResourceUsage | null | undefined>) {
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
      ephemeralStorageBytes = (ephemeralStorageBytes ?? 0) + item.ephemeralStorageBytes;
    }
  }

  return {
    cpuMillicores,
    ephemeralStorageBytes,
    memoryBytes,
  } satisfies FugueResourceUsage;
}

function buildProjectResourceUsageView(
  usage: FugueResourceUsage,
): ConsoleCompactResourceItemView[] {
  return [
    {
      id: "cpu",
      label: "Compute",
      meterValue: null,
      primaryLabel: formatCPUMillicoresLabel(usage.cpuMillicores),
      secondaryLabel: null,
      title: `Compute / ${formatCPUMillicoresLabel(usage.cpuMillicores)} / Current project total`,
      tone: usage.cpuMillicores !== null ? "info" : "neutral",
    },
    {
      id: "memory",
      label: "Memory",
      meterValue: null,
      primaryLabel: formatBytesLabel(usage.memoryBytes),
      secondaryLabel: null,
      title: `Memory / ${formatBytesLabel(usage.memoryBytes)} / Current project total`,
      tone: usage.memoryBytes !== null ? "info" : "neutral",
    },
    {
      id: "storage",
      label: "Disk",
      meterValue: null,
      primaryLabel: formatBytesLabel(usage.ephemeralStorageBytes),
      secondaryLabel: null,
      title: `Disk / ${formatBytesLabel(usage.ephemeralStorageBytes)} / Current project total`,
      tone: usage.ephemeralStorageBytes !== null ? "info" : "neutral",
    },
  ];
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

function normalizeRuntimeTargetLocation(location: {
  locationCountryCode: string | null;
  locationCountryLabel: string | null;
  locationLabel: string;
}): RuntimeTargetLocationView | null {
  const locationLabel =
    location.locationCountryLabel ??
    (location.locationLabel !== "Unassigned" ? location.locationLabel : null);

  if (!locationLabel && !location.locationCountryCode) {
    return null;
  }

  return {
    locationCountryCode: location.locationCountryCode,
    locationCountryLabel: location.locationCountryLabel,
    locationLabel,
  };
}

function buildRuntimeTargetLocationMap(nodes: FugueClusterNode[]) {
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
      readCountryLocation(node.region, node.zone),
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

      if (
        existing &&
        !isSameLocation(existing, nextLocation)
      ) {
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
  const normalized = value?.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "") ?? "";
  return normalized || null;
}

function readAppPhaseLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("deployed") ||
    normalized.includes("running") ||
    normalized.includes("healthy") ||
    normalized.includes("active")
  ) {
    return "Running";
  }

  return humanize(value);
}

function shortCommitSha(value?: string | null) {
  const commit = value?.trim();

  if (!commit) {
    return "";
  }

  return commit.length > 8 ? commit.slice(0, 8) : commit;
}

const terminalOperationStatuses = new Set(["canceled", "cancelled", "completed", "failed"]);

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

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingSeconds = elapsedSeconds % 60;

  if (elapsedMinutes < 60) {
    return remainingSeconds > 0 ? `${elapsedMinutes}m ${remainingSeconds}s` : `${elapsedMinutes}m`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const remainingMinutes = elapsedMinutes % 60;

  if (elapsedHours < 24) {
    return remainingMinutes > 0 ? `${elapsedHours}h ${remainingMinutes}m` : `${elapsedHours}h`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  const remainingHours = elapsedHours % 24;

  return remainingHours > 0 ? `${elapsedDays}d ${remainingHours}h` : `${elapsedDays}d`;
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
    normalized.includes("importing")
  ) {
    return "info";
  }

  if (
    normalized.includes("healthy") ||
    normalized.includes("active") ||
    normalized.includes("deployed") ||
    normalized.includes("completed")
  ) {
    return "positive";
  }

  return "neutral";
}

function isActiveOperation(status?: string | null) {
  return !terminalOperationStatuses.has(status?.trim().toLowerCase() ?? "");
}

function readOperationTimestamp(operation: FugueOperation) {
  return parseTimestamp(
    operation.completedAt ?? operation.updatedAt ?? operation.startedAt ?? operation.createdAt,
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
    (operation) => readOperationCommitSha(operation) === commitSha && isReleaseOperationCandidate(operation),
  );
  const buildMatches = releaseMatches.filter((operation) => isBuildLogsOperationCandidate(operation));
  const readActiveMatch = (items: FugueOperation[]) => items.find((operation) => isActiveOperation(operation.status)) ?? null;
  const readTerminalMatch = (items: FugueOperation[]) =>
    items.find((operation) => !isActiveOperation(operation.status)) ?? null;

  if (options.preferActive) {
    return (
      readActiveMatch(buildMatches) ??
      buildMatches[0] ??
      readActiveMatch(releaseMatches) ??
      releaseMatches[0] ??
      null
    );
  }

  return (
    readTerminalMatch(buildMatches) ??
    readTerminalMatch(releaseMatches) ??
    buildMatches[0] ??
    releaseMatches[0] ??
    null
  );
}

function readRunningBuildLogsOperation(app: FugueApp, commitOperations?: AppCommitOperations) {
  const releaseOperations = commitOperations?.releases ?? [];
  const runningCommitSha = app.source.commitSha?.trim() || null;

  if (runningCommitSha) {
    const matchingCommitOperation = findBuildLogsOperationForCommit(releaseOperations, runningCommitSha, {
      preferActive: false,
    });

    if (matchingCommitOperation) {
      return matchingCommitOperation;
    }
  }

  const lastOperationId = app.status.lastOperationId?.trim() || null;

  if (lastOperationId) {
    const matchingLastOperation = releaseOperations.find(
      (operation) => operation.id === lastOperationId && !isActiveOperation(operation.status),
    );

    if (matchingLastOperation) {
      return matchingLastOperation;
    }
  }

  return (
    releaseOperations.find(
      (operation) => isBuildLogsOperationCandidate(operation) && !isActiveOperation(operation.status),
    ) ??
    releaseOperations.find((operation) => !isActiveOperation(operation.status)) ??
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
    const matchingCommitOperation = findBuildLogsOperationForCommit(releaseOperations, pendingCommitSha, {
      preferActive: true,
    });

    if (matchingCommitOperation) {
      return matchingCommitOperation;
    }
  }

  if (activeOperation && isBuildLogsOperationCandidate(activeOperation)) {
    return activeOperation;
  }

  return (
    releaseOperations.find(
      (operation) => isBuildLogsOperationCandidate(operation) && isActiveOperation(operation.status),
    ) ??
    releaseOperations.find((operation) => isActiveOperation(operation.status)) ??
    null
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
  // Failed/error/stopped phases also do not represent a live release, so a
  // queued rebuild for those apps should transition into the pending view
  // instead of pinning the stale failed card.

  return (
    normalizedPhase.length > 0 &&
    [
      "running",
      "healthy",
      "active",
      "deployed",
      "disabled",
      "paused",
    ].some((keyword) => normalizedPhase.includes(keyword))
  );
}

function readActiveReleaseOperation(operation: FugueOperation | null | undefined, app: FugueApp) {
  if (!operation) {
    return null;
  }

  const normalizedType = operation.type?.trim().toLowerCase() ?? "";
  const normalizedStatus = operation.status?.trim().toLowerCase() ?? "";
  const desiredCommit = readOperationCommitSha(operation);
  const runningCommit = app.source.commitSha?.trim() || null;

  if (normalizedType === "import" || normalizedType === "build" || normalizedType === "deploy") {
    return operation;
  }

  if (
    normalizedStatus.includes("import") ||
    normalizedStatus.includes("build") ||
    normalizedStatus.includes("deploy")
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

function readRunningServiceMessage(app: FugueApp, activeOperation?: FugueOperation | null) {
  if (activeOperation) {
    return null;
  }

  return normalizeServiceMessage(app.status.lastMessage);
}

function readPendingServiceMessage(app: FugueApp, operation: FugueOperation) {
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

function readPendingCommitState(operation?: FugueOperation | null): Pick<ConsoleGalleryCommitView, "stateLabel" | "tone"> {
  const normalizedStatus = operation?.status?.trim().toLowerCase() ?? "";
  const normalizedType = operation?.type?.trim().toLowerCase() ?? "";

  if (normalizedStatus.includes("queued") || normalizedStatus.includes("pending")) {
    return {
      stateLabel: "Queued",
      tone: "warning",
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
      isGitHubSource(app) && !pendingCommitSha
        ? "Pending first import"
        : null,
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

  for (const operation of sortByTimestampDesc(operations, readOperationTimestamp)) {
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

function readRoute(app: FugueApp) {
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
  return normalizeHostname(app.route.baseDomain) ?? readRouteBaseDomain(readRouteHostname(app));
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
        "Pull the latest code from the tracked branch, rebuild from scratch, and roll out the new release. Fugue also redeploys automatically when upstream commits change and the app is idle.",
      label: "Redeploy",
      loadingLabel: "Redeploying…",
      queuedMessage: "Redeploy queued.",
    };
  }

  if (isDockerImageSource(app)) {
    return {
      description:
        "Pull the saved image reference again, mirror it into Fugue’s internal registry, and roll out a new release.",
      label: "Repull image",
      loadingLabel: "Repulling image…",
      queuedMessage: "Image repull queued.",
    };
  }

  return {
    description:
      "Rebuild from the saved source from scratch and roll out a new release. If a workspace is configured, the next rollout resets it.",
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

  if (isGitHubSourceType(sourceType) || sourceType === "docker-image" || sourceType === "upload") {
    return {
      canRedeploy: true,
      redeployDisabledReason: null,
    };
  }

  if (!sourceType) {
    return {
      canRedeploy: false,
      redeployDisabledReason: "Redeploy requires an imported source definition.",
    };
  }

  return {
    canRedeploy: false,
    redeployDisabledReason: `Redeploy only works for imported GitHub, Docker image, or upload apps. Current source: ${humanize(app.source.type)}.`,
  };
}

function sortByTimestampDesc<T>(items: T[], readTimestamp: (item: T) => number) {
  return [...items].sort((left, right) => readTimestamp(right) - readTimestamp(left));
}

function readAppTimestamp(app: FugueApp) {
  return parseTimestamp(app.status.updatedAt ?? app.updatedAt ?? app.createdAt);
}

function readServiceTimestamp(service: FugueBackingService) {
  return parseTimestamp(service.updatedAt ?? service.createdAt);
}

function readProjectTimestamp(project: FugueProject) {
  return parseTimestamp(project.updatedAt ?? project.createdAt);
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
    const label = normalizedName || readTechnologyLabel(normalizedSlug) || humanize(normalizedSlug);
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

function buildDetectedStackTech(source?: FugueAppSource | null): FugueAppTechnology[] {
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
  const detectedStackKind = readLanguageBadgeKind(source.detectedStack) ?? "runtime";
  const detectedProviderKind = readLanguageBadgeKind(source.detectedProvider);

  return [
    source.detectedStack
      ? {
          id: readBadgeKey(
            detectedStackKind,
            readTechnologyLabel(source.detectedStack) || humanize(source.detectedStack),
          ),
          kind: detectedStackKind,
          label:
            readTechnologyLabel(source.detectedStack) || humanize(source.detectedStack),
          meta: "Stack",
        }
      : null,
    !source.detectedStack && source.detectedProvider && detectedProviderKind
      ? {
          id: readBadgeKey(
            detectedProviderKind,
            readTechnologyLabel(source.detectedProvider) || humanize(source.detectedProvider),
          ),
          kind: detectedProviderKind,
          label:
            readTechnologyLabel(source.detectedProvider) || humanize(source.detectedProvider),
          meta:
            detectedProviderKind === "nextjs" || detectedProviderKind === "react"
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
    badges.find((badge) => badge.kind !== "postgres" && badge.meta !== "Build") ??
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
  const sourceLanguageBadge = sourceBadges.find(
    (badge) => badge.meta === "Language" || badge.meta === "Stack",
  ) ?? null;
  const sourceBuildBadge = sourceBadges.find((badge) => badge.meta === "Build") ?? null;

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

function buildSharedAppView(
  app: FugueApp,
  options?: {
    location?: WorkloadLocationView | null;
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
  const sourceBranchLabel = readSourceBranchLabelFromSource(source);
  const serviceBadges = buildAppBadges(app, { source, techStack });
  const primaryBadge =
    readPrimaryBadge(serviceBadges) ??
    serviceBadges[0] ?? {
      id: readBadgeKey("runtime", humanize(source.type)),
      kind: "runtime",
      label: humanize(source.type),
      meta: "Service",
    };

  return {
    canRedeploy: redeploy.canRedeploy,
    deployBehavior: readDeployBehavior(app),
    hasPostgresService: app.backingServices.some((service) => service.type === "postgres"),
    id: app.id,
    locationCountryCode: options?.location?.locationCountryCode ?? null,
    locationLabel: options?.location?.locationLabel ?? null,
    name: app.name,
    primaryBadge,
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
    workspaceMountPath: app.spec.workspace ? app.spec.workspace.mountPath ?? "/workspace" : null,
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
    | "serviceDurationLabel"
    | "serviceRole"
  >;
}

function buildAppView(
  app: FugueApp,
  commitOperations?: AppCommitOperations,
  location?: WorkloadLocationView | null,
): ConsoleGalleryAppView[] {
  const activeOperation = readActiveReleaseOperation(commitOperations?.active ?? null, app);
  const commitViews = buildCommitViews(app, activeOperation);
  const runningBuildLogsOperation = readRunningBuildLogsOperation(app, commitOperations);
  const pendingBuildLogsOperation = activeOperation
    ? readPendingBuildLogsOperation(activeOperation, commitOperations)
    : null;
  const activePhase = activeOperation ? readPendingCommitState(activeOperation) : null;
  const primaryCommit = commitViews.find((entry) => entry.kind === "running") ?? commitViews[0] ?? null;
  const currentCommitLabel =
    primaryCommit?.label ?? (isGitHubSource(app) ? readCurrentCommitLabel(app) : null);
  const fallbackPhase = app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown");
  const sharedView = buildSharedAppView(app, { location });
  const pendingSharedView = activeOperation
    ? buildSharedAppView(app, {
        location,
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
          lastMessage: readRunningServiceMessage(app, activeOperation),
          phase: readAppPhaseLabel(fallbackPhase),
          phaseTone: toneForStatus(fallbackPhase),
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
          serviceDurationLabel: formatElapsedDuration(readOperationStartedAt(activeOperation)),
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

function buildBackingServiceView(
  service: FugueBackingService,
  appNames: Map<string, string>,
  location?: WorkloadLocationView | null,
): ConsoleGalleryBackingServiceView {
  return {
    description:
      service.spec.postgres?.database ??
      service.description ??
      "Attached backing service.",
    id: service.id,
    locationCountryCode: location?.locationCountryCode ?? null,
    locationLabel: location?.locationLabel ?? null,
    name: service.name,
    ownerAppId: service.ownerAppId,
    ownerAppLabel: service.ownerAppId
      ? appNames.get(service.ownerAppId) ?? "Attached app"
      : "Attached app",
    primaryBadge: {
      id: readBadgeKey("postgres", "PostgreSQL"),
      kind: "postgres",
      label: "PostgreSQL",
      meta: "Service",
    },
    status: humanize(service.status),
    statusTone: toneForStatus(service.status),
    type: humanize(service.type),
  };
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

    if (service.kind === "app" && service.serviceRole === "pending" && badges.has(key)) {
      continue;
    }

    badges.set(key, {
      ...service.primaryBadge,
      id: key,
    });
  }

  return [...badges.values()];
}

function projectNameMap(projects: FugueProject[], fallbackId?: string | null, fallbackName?: string | null) {
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
): ConsoleImportRuntimeTargetView {
  const runtimeLocation = readRuntimeLocation(runtime.labels);
  const shouldUseFallbackLocation =
    runtime.type !== "managed-shared" ||
    runtime.id !== DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID ||
    hasInternalClusterLocationTarget(runtime.labels);
  const location = {
    ...runtimeLocation,
    locationCountryCode:
      runtimeLocation.locationCountryCode ??
      (shouldUseFallbackLocation ? fallbackLocation?.locationCountryCode : null) ??
      null,
    locationCountryLabel:
      runtimeLocation.locationCountryLabel ??
      (shouldUseFallbackLocation ? fallbackLocation?.locationCountryLabel : null) ??
      null,
    locationLabel:
      runtimeLocation.locationLabel ??
      (shouldUseFallbackLocation ? fallbackLocation?.locationLabel : null) ??
      null,
  };
  const statusLabel = runtime.status ? humanize(runtime.status) : null;
  const statusTone = runtime.status ? toneForStatus(runtime.status) : null;

  if (runtime.type === "managed-shared") {
    const isGenericInternalCluster =
      runtime.id === DEFAULT_INTERNAL_CLUSTER_RUNTIME_ID &&
      !hasInternalClusterLocationTarget(runtime.labels);
    const primaryLabel = isGenericInternalCluster
      ? "Any available region"
      : location.locationCountryLabel ?? location.locationLabel ?? "Region unavailable";

    return {
      category: "internal-cluster",
      description: !isGenericInternalCluster && location.hasPlacementConstraint
        ? "Use shared capacity in this region."
        : "Deploy onto the internal cluster.",
      id: runtime.id,
      kindLabel: "Internal cluster",
      locationCountryCode: location.locationCountryCode,
      locationCountryLabel: location.locationCountryLabel,
      locationLabel: isGenericInternalCluster ? null : location.locationLabel,
      primaryLabel,
      statusLabel,
      statusTone,
      summaryLabel: `Internal cluster / ${primaryLabel}`,
    };
  }

  const primaryLabel =
    runtime.name?.trim() ||
    runtime.machineName?.trim() ||
    shortId(runtime.id);
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

  const primaryLabelComparison = left.primaryLabel.localeCompare(right.primaryLabel, "en", {
    sensitivity: "base",
  });

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

export const getConsoleProjectGalleryData = cache(async () => {
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
      getFugueProjects(workspace.adminKeySecret, workspace.tenantId ?? undefined),
      getFugueApps(workspace.adminKeySecret),
      getFugueOperations(workspace.adminKeySecret),
      getFugueClusterNodes(workspace.adminKeySecret),
      getFugueRuntimes(workspace.adminKeySecret),
    ]);
  }

  let workspace = initialWorkspace;
  let [projectsResult, appsResult, operationsResult, clusterNodesResult, runtimesResult] =
    await loadWorkspaceData(workspace);

  if (
    projectsResult.status === "rejected" &&
    appsResult.status === "rejected" &&
    operationsResult.status === "rejected" &&
    runtimesResult.status === "rejected" &&
    isUnauthorizedFugueError(projectsResult.reason) &&
    isUnauthorizedFugueError(appsResult.reason) &&
    isUnauthorizedFugueError(operationsResult.reason) &&
    isUnauthorizedFugueError(runtimesResult.reason)
  ) {
    const session = await getCurrentSession();

    if (session) {
      try {
        const refreshed = await ensureWorkspaceAccess(session);
        workspace = refreshed.workspace;
        [projectsResult, appsResult, operationsResult, clusterNodesResult, runtimesResult] =
          await loadWorkspaceData(workspace);
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
  ].filter((value): value is string => Boolean(value));

  const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const operations = operationsResult.status === "fulfilled" ? operationsResult.value : [];
  const clusterNodes = clusterNodesResult.status === "fulfilled" ? clusterNodesResult.value : [];
  const runtimeTargetLocationsByRuntimeId = buildRuntimeTargetLocationMap(clusterNodes);
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
  const workloadLocationsById = buildWorkloadLocationMap(clusterNodes);
  const appsByProjectId = new Map<string, FugueApp[]>();

  for (const app of apps) {
    const projectId = app.projectId ?? "unassigned";
    const bucket = appsByProjectId.get(projectId) ?? [];
    bucket.push(app);
    appsByProjectId.set(projectId, bucket);
  }

  const projectsById = new Map(projects.map((project) => [project.id, project] as const));
  const projectIds = [...new Set([...projects.map((project) => project.id), ...appsByProjectId.keys()])];

  const projectViews = projectIds
    .map((projectId) => {
      const project = projectsById.get(projectId) ?? null;
      const projectApps = appsByProjectId.get(projectId) ?? [];
      const sortedApps = sortByTimestampDesc(projectApps, readAppTimestamp);
      const appNames = new Map(sortedApps.map((app) => [app.id, app.name] as const));
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
      const resourceUsage = sumCurrentResourceUsage([
        ...sortedApps.map((app) => app.currentResourceUsage),
        ...backingServices.map((service) => service.currentResourceUsage),
      ]);
      const latestActivity = Math.max(
        project ? readProjectTimestamp(project) : 0,
        ...sortedApps.map(readAppTimestamp),
        ...backingServices.map(readServiceTimestamp),
      );
      const appViews = sortedApps.flatMap((app) =>
        buildAppView(
          app,
          commitOperationsByAppId.get(app.id),
          workloadLocationsById.get(app.id) ?? null,
        ).map((service) => ({
          kind: "app" as const,
          ...service,
        })),
      );
      const backingServiceViews = backingServices.map((service) => ({
        kind: "backing-service" as const,
        ...buildBackingServiceView(
          service,
          appNames,
          workloadLocationsById.get(service.id) ?? null,
        ),
      }));
      const services = [...appViews, ...backingServiceViews];

      return {
        appCount: sortedApps.length,
        id: projectId,
        name:
          namesByProjectId.get(projectId) ??
          project?.name ??
          (projectId === "unassigned" ? "Unassigned" : humanize(projectId)),
        resourceUsage: buildProjectResourceUsageView(resourceUsage),
        serviceBadges: buildProjectServiceBadges(services),
        serviceCount: services.length,
        services,
        sortTimestamp: latestActivity,
      };
    })
    .sort(
      (left, right) => right.sortTimestamp - left.sortTimestamp,
    )
    .map(({ sortTimestamp: _sortTimestamp, ...project }) => project as ConsoleGalleryProjectView);

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
});
