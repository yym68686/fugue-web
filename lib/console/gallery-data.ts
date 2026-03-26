import "server-only";

import { cache } from "react";

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
import { getCurrentWorkspaceAccess } from "@/lib/workspace/current";

function readErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return "Unknown Fugue request error.";
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
  commitOperations?: AppCommitOperations,
): ConsoleGalleryCommitView[] {
  const pendingOperation = commitOperations?.active ?? null;
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
    };

    if (isActiveOperation(operation.status)) {
      if (!entry.active) {
        entry.active = operation;
      }
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

function readSourceLabel(app: FugueApp) {
  if (app.source.repoUrl) {
    return formatRepoLabel(app.source.repoUrl, app.source.repoBranch);
  }

  if (app.source.type?.trim()) {
    if (app.source.type === "upload") {
      return "Local upload";
    }

    return humanize(app.source.type);
  }

  return "Unspecified source";
}

function isGitHubPublicSource(app: FugueApp) {
  return app.source.type?.trim().toLowerCase() === "github-public";
}

function isUploadSource(app: FugueApp) {
  return app.source.type?.trim().toLowerCase() === "upload";
}

function readSourceBranchLabel(app: FugueApp) {
  if (!isGitHubPublicSource(app)) {
    return null;
  }

  return app.source.repoBranch?.trim() || "Default branch";
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
        "Queue an immediate import -> deploy from the tracked branch. Fugue also syncs automatically when upstream commits change and the app is idle.",
      label: "Sync now",
      loadingLabel: "Syncing…",
      queuedMessage: "GitHub sync queued.",
    };
  }

  return {
    description: "Rebuild from the saved source and reset the workspace on the next rollout.",
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

function readLanguageBadgeKind(value?: string | null): ConsoleGalleryBadgeKind | null {
  switch (value?.trim().toLowerCase()) {
    case "node":
    case "nodejs":
      return "node";
    case "python":
      return "python";
    case "go":
      return "go";
    case "java":
      return "java";
    case "ruby":
      return "ruby";
    case "php":
      return "php";
    case "dotnet":
      return "dotnet";
    case "rust":
      return "rust";
    default:
      return null;
  }
}

function readBuildBadgeKind(value?: string | null): ConsoleGalleryBadgeKind | null {
  switch (value?.trim().toLowerCase()) {
    case "dockerfile":
      return "docker";
    case "buildpacks":
      return "buildpacks";
    case "nixpacks":
      return "nixpacks";
    case "static-site":
      return "static";
    default:
      return null;
  }
}

function readLanguageLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "node":
    case "nodejs":
      return "Node.js";
    case "python":
      return "Python";
    case "go":
      return "Go";
    case "java":
      return "Java";
    case "ruby":
      return "Ruby";
    case "php":
      return "Php";
    case "dotnet":
      return "Dotnet";
    case "rust":
      return "Rust";
    default:
      return humanize(value);
  }
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

  if (normalizedKind === "language") {
    const label = normalizedName || readLanguageLabel(normalizedSlug);
    const kind = readLanguageBadgeKind(normalizedSlug) ?? "runtime";
    return {
      id: readBadgeKey(kind, label),
      kind,
      label,
      meta: "Language",
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

function buildSourceBadges(app: FugueApp) {
  return [
    app.source.detectedProvider
      ? {
          id: readBadgeKey(
            readLanguageBadgeKind(app.source.detectedProvider) ?? "runtime",
            readLanguageLabel(app.source.detectedProvider),
          ),
          kind: readLanguageBadgeKind(app.source.detectedProvider) ?? "runtime",
          label: readLanguageLabel(app.source.detectedProvider),
          meta: "Language",
        }
      : null,
    app.source.buildStrategy
      ? {
          id: readBadgeKey(
            readBuildBadgeKind(app.source.buildStrategy) ?? "runtime",
            humanize(app.source.buildStrategy),
          ),
          kind: readBuildBadgeKind(app.source.buildStrategy) ?? "runtime",
          label: humanize(app.source.buildStrategy),
          meta: "Build",
        }
      : null,
  ].filter((badge): badge is ConsoleGalleryBadgeView => Boolean(badge));
}

function readPrimaryBadge(badges: ConsoleGalleryBadgeView[]) {
  return (
    badges.find((badge) => badge.meta === "Language") ??
    badges.find((badge) => badge.kind !== "postgres" && badge.meta !== "Build") ??
    badges.find((badge) => badge.kind !== "postgres") ??
    badges[0] ??
    null
  );
}

function buildAppBadges(app: FugueApp): ConsoleGalleryBadgeView[] {
  const badges = new Map<string, ConsoleGalleryBadgeView>();
  const sourceBadges = buildSourceBadges(app);
  const sourceLanguageBadge = sourceBadges.find((badge) => badge.meta === "Language") ?? null;
  const sourceBuildBadge = sourceBadges.find((badge) => badge.meta === "Build") ?? null;

  const addBadge = (badge: ConsoleGalleryBadgeView | null) => {
    if (!badge || badges.has(badge.id)) {
      return;
    }

    badges.set(badge.id, badge);
  };

  addBadge(sourceLanguageBadge);

  if (app.techStack.length) {
    for (const item of app.techStack) {
      const normalizedKind = item.kind.trim().toLowerCase();
      const normalizedSlug = item.slug.trim().toLowerCase();

      if (normalizedKind === "build" || normalizedSlug === "postgres") {
        continue;
      }

      addBadge(buildBadgeFromTechStack(item));
    }
  }

  addBadge(sourceBuildBadge);

  if (!badges.size && app.techStack.length) {
    for (const item of app.techStack) {
      if (item.slug.trim().toLowerCase() === "postgres") {
        continue;
      }

      addBadge(buildBadgeFromTechStack(item, { includeBuild: true }));
    }
  }

  if (!badges.size) {
    addBadge({
      id: readBadgeKey("runtime", humanize(app.source.type)),
      kind: "runtime",
      label: humanize(app.source.type),
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

function buildAppView(
  app: FugueApp,
  commitOperations?: AppCommitOperations,
): ConsoleGalleryAppView {
  const route = readRoute(app);
  const redeploy = readRedeployState(app);
  const redeployAction = readRedeployAction(app);
  const sourceBranchLabel = readSourceBranchLabel(app);
  const commitViews = buildCommitViews(app, commitOperations);
  const serviceBadges = buildAppBadges(app);
  const primaryBadge =
    readPrimaryBadge(serviceBadges) ??
    serviceBadges[0] ?? {
      id: readBadgeKey("runtime", humanize(app.source.type)),
      kind: "runtime",
      label: humanize(app.source.type),
      meta: "Service",
    };
  const activeOperation = commitOperations?.active ?? null;
  const activePhase = activeOperation ? readPendingCommitState(activeOperation) : null;
  const primaryCommit = commitViews.find((entry) => entry.kind === "running") ?? commitViews[0] ?? null;
  const currentCommitLabel =
    primaryCommit?.label ?? (isGitHubPublicSource(app) ? readCurrentCommitLabel(app) : null);
  const fallbackPhase = app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown");
  const serviceDurationLabel = formatElapsedDuration(readOperationStartedAt(activeOperation));

  return {
    commitViews,
    canRedeploy: redeploy.canRedeploy,
    currentCommitCommittedAt: primaryCommit?.committedAt ?? null,
    currentCommitExact: primaryCommit?.exact ?? null,
    currentCommitHref: primaryCommit?.href ?? null,
    currentCommitLabel,
    deployBehavior: readDeployBehavior(app),
    hasPostgresService: app.backingServices.some((service) => service.type === "postgres"),
    id: app.id,
    lastMessage: app.status.lastMessage ?? "No current status message.",
    name: app.name,
    phase: activePhase?.stateLabel ?? readAppPhaseLabel(fallbackPhase),
    phaseTone: activePhase?.tone ?? toneForStatus(fallbackPhase),
    primaryBadge,
    redeployActionDescription: redeployAction.description,
    redeployActionLabel: redeployAction.label,
    redeployActionLoadingLabel: redeployAction.loadingLabel,
    redeployQueuedMessage: redeployAction.queuedMessage,
    redeployDisabledReason: redeploy.redeployDisabledReason,
    routeHref: route.href,
    routeLabel: route.label,
    serviceBadges,
    serviceDurationLabel,
    sourceBranchHref:
      sourceBranchLabel && sourceBranchLabel !== "Default branch"
        ? readGitHubBranchHref(app.source.repoUrl, app.source.repoBranch)
        : null,
    sourceBranchLabel,
    sourceHref: readGitHubSourceHref(app.source.repoUrl),
    sourceLabel: readSourceLabel(app),
    sourceMeta:
      [humanize(app.source.buildStrategy), app.source.composeService, app.source.dockerfilePath]
        .filter((value) => value && value !== "Unknown")
        .join(" / ") || humanize(app.source.type),
    sourceType: app.source.type,
    workspaceMountPath: app.spec.workspace ? app.spec.workspace.mountPath ?? "/workspace" : null,
  };
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
  return services.map((service) => ({
    ...service.primaryBadge,
    id: `project-service:${service.kind}:${service.id}`,
  }));
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
  const workspace = await getCurrentWorkspaceAccess();

  if (!workspace) {
    return {
      errors: [],
      projects: [],
      workspace: {
        exists: false,
        stage: "needs-workspace",
      },
    } satisfies ConsoleProjectGalleryData;
  }

  const [projectsResult, appsResult, operationsResult] = await Promise.allSettled([
    getFugueProjects(workspace.adminKeySecret, workspace.tenantId ?? undefined),
    getFugueApps(workspace.adminKeySecret),
    getFugueOperations(workspace.adminKeySecret),
  ]);

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
      const appViews = sortedApps.map((app) => ({
        kind: "app" as const,
        ...buildAppView(app, commitOperationsByAppId.get(app.id)),
      }));
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
