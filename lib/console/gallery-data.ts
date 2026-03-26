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
  ConsoleGalleryProjectView,
  ConsoleProjectGalleryData,
} from "@/lib/console/gallery-types";
import {
  getFugueApps,
  getFugueOperations,
  getFugueProjects,
  type FugueApp,
  type FugueAppSource,
  type FugueBackingService,
  type FugueOperation,
  type FugueProject,
  type FugueAppTechnology,
} from "@/lib/fugue/api";
import {
  readGitHubBranchHref,
  readGitHubCommitHref,
  readGitHubSourceHref,
} from "@/lib/fugue/source-links";
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

function humanize(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
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

  if (app.status.currentRuntimeId?.trim()) {
    return true;
  }

  if ((app.status.currentReplicas ?? 0) > 0) {
    return true;
  }

  if (app.source.commitSha?.trim()) {
    return true;
  }

  return (
    normalizedPhase.length > 0 &&
    [
      "running",
      "healthy",
      "active",
      "deployed",
      "disabled",
      "paused",
      "error",
      "failed",
      "stopped",
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
      isGitHubPublicSource(app) && !pendingCommitSha
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

function formatRepoLabel(repoUrl?: string | null, branch?: string | null) {
  if (!repoUrl) {
    return "Unspecified source";
  }

  try {
    const url = new URL(repoUrl);
    const repo = url.pathname.replace(/^\/|\/$/g, "");
    return branch ? `${repo} · ${branch}` : repo;
  } catch {
    return branch ? `${repoUrl} · ${branch}` : repoUrl;
  }
}

function isGitHubPublicAppSource(source?: FugueAppSource | null) {
  return source?.type?.trim().toLowerCase() === "github-public";
}

function isUploadAppSource(source?: FugueAppSource | null) {
  return source?.type?.trim().toLowerCase() === "upload";
}

function readSourceLabelFromSource(source: FugueAppSource) {
  if (source.repoUrl) {
    return formatRepoLabel(source.repoUrl, source.repoBranch);
  }

  if (source.type?.trim()) {
    if (source.type === "upload") {
      return "Local upload";
    }

    return humanize(source.type);
  }

  return "Unspecified source";
}

function readSourceLabel(app: FugueApp) {
  return readSourceLabelFromSource(app.source);
}

function isGitHubPublicSource(app: FugueApp) {
  return isGitHubPublicAppSource(app.source);
}

function isUploadSource(app: FugueApp) {
  return isUploadAppSource(app.source);
}

function readSourceBranchLabelFromSource(source: FugueAppSource) {
  if (!isGitHubPublicAppSource(source)) {
    return null;
  }

  return source.repoBranch?.trim() || "Default branch";
}

function readSourceBranchLabel(app: FugueApp) {
  return readSourceBranchLabelFromSource(app.source);
}

function readCurrentCommitLabel(app: FugueApp) {
  if (!isGitHubPublicSource(app)) {
    return null;
  }

  return shortCommitSha(app.source.commitSha) || "Pending first import";
}

function readRedeployAction(app: FugueApp) {
  if (isGitHubPublicSource(app)) {
    return {
      description:
        "Pull the latest code from the tracked branch, rebuild from scratch, and roll out the new release. Fugue also redeploys automatically when upstream commits change and the app is idle.",
      label: "Redeploy",
      loadingLabel: "Redeploying…",
      queuedMessage: "Redeploy queued.",
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
  if (isGitHubPublicSource(app) || isUploadSource(app)) {
    return "Deploy completes only after the new Kubernetes rollout is ready and old replicas have drained.";
  }

  return "Deploy completes only after the new Kubernetes rollout is ready.";
}

function readRedeployState(app: FugueApp) {
  const sourceType = app.source.type?.trim().toLowerCase() ?? "";

  if (sourceType === "github-public" || sourceType === "upload") {
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
    redeployDisabledReason: `Redeploy only works for imported GitHub or upload apps. Current source: ${humanize(app.source.type)}.`,
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
    source?: FugueAppSource | null;
    techStack?: FugueAppTechnology[];
  },
) {
  const source = options?.source ?? app.source;
  const techStack = options?.techStack ?? app.techStack;
  const route = readRoute(app);
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
    name: app.name,
    primaryBadge,
    redeployActionDescription: redeployAction.description,
    redeployActionLabel: redeployAction.label,
    redeployActionLoadingLabel: redeployAction.loadingLabel,
    redeployQueuedMessage: redeployAction.queuedMessage,
    redeployDisabledReason: redeploy.redeployDisabledReason,
    routeHref: route.href,
    routeLabel: route.label,
    serviceBadges,
    sourceBranchHref:
      sourceBranchLabel && sourceBranchLabel !== "Default branch"
        ? readGitHubBranchHref(source.repoUrl, source.repoBranch)
        : null,
    sourceBranchLabel,
    sourceHref: readGitHubSourceHref(source.repoUrl),
    sourceLabel: readSourceLabelFromSource(source),
    sourceMeta:
      [humanize(source.buildStrategy), source.composeService, source.dockerfilePath]
        .filter((value) => value && value !== "Unknown")
        .join(" / ") || humanize(source.type),
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
    primaryCommit?.label ?? (isGitHubPublicSource(app) ? readCurrentCommitLabel(app) : null);
  const fallbackPhase = app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown");
  const sharedView = buildSharedAppView(app);
  const pendingSharedView = activeOperation
    ? buildSharedAppView(app, {
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
): ConsoleGalleryBackingServiceView {
  return {
    description:
      service.spec.postgres?.database ??
      service.description ??
      "Attached backing service.",
    id: service.id,
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

  if (fallbackId && fallbackName) {
    names.set(fallbackId, fallbackName);
  }

  return names;
}

export const getConsoleProjectGalleryData = cache(async () => {
  const initialWorkspace = await getCurrentWorkspaceAccess();

  if (!initialWorkspace) {
    return {
      errors: [],
      projects: [],
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
    ]);
  }

  let workspace = initialWorkspace;
  let [projectsResult, appsResult, operationsResult] = await loadWorkspaceData(workspace);

  if (
    projectsResult.status === "rejected" &&
    appsResult.status === "rejected" &&
    operationsResult.status === "rejected" &&
    isUnauthorizedFugueError(projectsResult.reason) &&
    isUnauthorizedFugueError(appsResult.reason) &&
    isUnauthorizedFugueError(operationsResult.reason)
  ) {
    const session = await getCurrentSession();

    if (session) {
      try {
        const refreshed = await ensureWorkspaceAccess(session);
        workspace = refreshed.workspace;
        [projectsResult, appsResult, operationsResult] = await loadWorkspaceData(workspace);
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
  ].filter((value): value is string => Boolean(value));

  const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const operations = operationsResult.status === "fulfilled" ? operationsResult.value : [];
  const namesByProjectId = projectNameMap(
    projects,
    workspace.defaultProjectId,
    workspace.defaultProjectName,
  );
  const commitOperationsByAppId = collectCommitOperationsByAppId(operations);
  const appsByProjectId = new Map<string, FugueApp[]>();

  for (const app of apps) {
    const projectId = app.projectId ?? "unassigned";
    const bucket = appsByProjectId.get(projectId) ?? [];
    bucket.push(app);
    appsByProjectId.set(projectId, bucket);
  }

  const projectViews = [...appsByProjectId.entries()]
    .map(([projectId, projectApps]) => {
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
      const latestActivity = Math.max(
        0,
        ...sortedApps.map(readAppTimestamp),
        ...backingServices.map(readServiceTimestamp),
      );
      const appViews = sortedApps.flatMap((app) =>
        buildAppView(app, commitOperationsByAppId.get(app.id)).map((service) => ({
          kind: "app" as const,
          ...service,
        })),
      );
      const backingServiceViews = backingServices.map((service) => ({
        kind: "backing-service" as const,
        ...buildBackingServiceView(service, appNames),
      }));
      const services = [...appViews, ...backingServiceViews];

      return {
        appCount: sortedApps.length,
        id: projectId,
        name:
          namesByProjectId.get(projectId) ??
          (projectId === "unassigned" ? "Unassigned" : humanize(projectId)),
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
    workspace: {
      exists: true,
      stage: projectViews.length > 0 ? "ready" : "empty",
    },
  } satisfies ConsoleProjectGalleryData;
});
