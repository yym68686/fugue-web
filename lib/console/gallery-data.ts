import "server-only";

import { cache } from "react";

import type { ConsoleTone } from "@/lib/console/types";
import type {
  ConsoleGalleryAppView,
  ConsoleGalleryBadgeKind,
  ConsoleGalleryBadgeView,
  ConsoleGalleryBackingServiceView,
  ConsoleGalleryProjectView,
  ConsoleProjectGalleryData,
} from "@/lib/console/gallery-types";
import {
  getFugueApps,
  getFugueProjects,
  type FugueApp,
  type FugueBackingService,
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

function shortCommitSha(value?: string | null) {
  const commit = value?.trim();

  if (!commit) {
    return "";
  }

  return commit.length > 8 ? commit.slice(0, 8) : commit;
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

function readSyncState(app: FugueApp): {
  summary: string;
  tone: ConsoleTone;
  label: string;
} {
  if (isGitHubPublicSource(app)) {
    const trackedBranch = app.source.repoBranch?.trim()
      ? `branch ${app.source.repoBranch.trim()}`
      : "the repository default branch";

    if ((app.spec.replicas ?? 0) > 0) {
      return {
        label: "Auto sync active",
        summary: `Fugue watches ${trackedBranch} and queues import -> deploy when the upstream commit changes and no operation is in flight.`,
        tone: "positive",
      };
    }

    return {
      label: "Auto sync paused",
      summary: "GitHub sync is paused while the app is scaled to zero. Scale the app above zero to resume upstream checks.",
      tone: "warning",
    };
  }

  if (isUploadSource(app)) {
    return {
      label: "Manual updates",
      summary: "This app redeploys from the stored upload only when you trigger a rebuild.",
      tone: "neutral",
    };
  }

  return {
    label: "Manual updates",
    summary: "This source updates only when you queue a new operation from the console or API.",
    tone: "neutral",
  };
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

function buildAppBadges(app: FugueApp): ConsoleGalleryBadgeView[] {
  const badges = new Map<string, ConsoleGalleryBadgeView>();

  const addBadge = (badge: ConsoleGalleryBadgeView | null) => {
    if (!badge || badges.has(badge.id)) {
      return;
    }

    badges.set(badge.id, badge);
  };

  if (app.techStack.length) {
    for (const item of app.techStack) {
      if (item.kind.trim().toLowerCase() === "build") {
        continue;
      }

      addBadge(buildBadgeFromTechStack(item));
    }
  }

  if (app.backingServices.some((service) => service.type === "postgres")) {
    addBadge({
      id: readBadgeKey("postgres", "PostgreSQL"),
      kind: "postgres",
      label: "PostgreSQL",
      meta: "Service",
    });
  }

  if (!badges.size && app.techStack.length) {
    for (const item of app.techStack) {
      addBadge(buildBadgeFromTechStack(item, { includeBuild: true }));
    }
  }

  if (!badges.size) {
    addBadge(
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
    );
    addBadge(
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
    );
  }

  if (!badges.size) {
    addBadge({
      id: readBadgeKey("runtime", humanize(app.source.type)),
      kind: "runtime",
      label: humanize(app.source.type),
      meta: "Service",
    });
  }

  return [...badges.values()].slice(0, 6);
}

function buildProjectBadges(
  apps: FugueApp[],
): ConsoleGalleryBadgeView[] {
  const badges = new Map<string, ConsoleGalleryBadgeView>();

  for (const app of apps) {
    for (const badge of buildAppBadges(app)) {
      badges.set(badge.id, badge);
    }
  }

  return [...badges.values()].slice(0, 6);
}

function buildAppView(app: FugueApp): ConsoleGalleryAppView {
  const route = readRoute(app);
  const redeploy = readRedeployState(app);
  const syncState = readSyncState(app);
  const redeployAction = readRedeployAction(app);
  const sourceBranchLabel = readSourceBranchLabel(app);
  const currentCommitLabel = readCurrentCommitLabel(app);

  return {
    canRedeploy: redeploy.canRedeploy,
    currentCommitCommittedAt: app.source.commitCommittedAt?.trim() || null,
    currentCommitExact: app.source.commitSha?.trim() || null,
    currentCommitHref: readGitHubCommitHref(app.source.repoUrl, app.source.commitSha),
    currentCommitLabel,
    deployBehavior: readDeployBehavior(app),
    hasPostgresService: app.backingServices.some((service) => service.type === "postgres"),
    id: app.id,
    lastMessage: app.status.lastMessage ?? "No current status message.",
    name: app.name,
    phase: humanize(app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown")),
    phaseTone: toneForStatus(app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown")),
    redeployActionDescription: redeployAction.description,
    redeployActionLabel: redeployAction.label,
    redeployActionLoadingLabel: redeployAction.loadingLabel,
    redeployQueuedMessage: redeployAction.queuedMessage,
    redeployDisabledReason: redeploy.redeployDisabledReason,
    routeHref: route.href,
    routeLabel: route.label,
    serviceBadges: buildAppBadges(app),
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
    syncStatusLabel: syncState.label,
    syncStatusTone: syncState.tone,
    syncSummary: syncState.summary,
    updatedExact: formatExactTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
    updatedLabel: formatRelativeTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
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
    ownerAppLabel: service.ownerAppId
      ? appNames.get(service.ownerAppId) ?? "Attached app"
      : "Attached app",
    status: humanize(service.status),
    statusTone: toneForStatus(service.status),
    type: humanize(service.type),
    updatedExact: formatExactTime(service.updatedAt ?? service.createdAt),
    updatedLabel: formatRelativeTime(service.updatedAt ?? service.createdAt),
  };
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

  const [projectsResult, appsResult] = await Promise.allSettled([
    getFugueProjects(workspace.adminKeySecret, workspace.tenantId ?? undefined),
    getFugueApps(workspace.adminKeySecret),
  ]);

  const errors = [
    projectsResult.status === "rejected"
      ? `projects: ${readErrorMessage(projectsResult.reason)}`
      : null,
    appsResult.status === "rejected"
      ? `apps: ${readErrorMessage(appsResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const namesByProjectId = projectNameMap(
    projects,
    workspace.defaultProjectId,
    workspace.defaultProjectName,
  );
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

      return {
        appCount: sortedApps.length,
        id: projectId,
        latestActivityExact: formatExactTime(
          latestActivity ? new Date(latestActivity).toISOString() : null,
        ),
        latestActivityLabel: formatRelativeTime(
          latestActivity ? new Date(latestActivity).toISOString() : null,
        ),
        name:
          namesByProjectId.get(projectId) ??
          (projectId === "unassigned" ? "Unassigned" : humanize(projectId)),
        serviceBadges: buildProjectBadges(sortedApps),
        serviceCount: sortedApps.length + backingServices.length,
        services: [
          ...sortedApps.map((app) => ({
            kind: "app" as const,
            ...buildAppView(app),
          })),
          ...backingServices.map((service) => ({
            kind: "backing-service" as const,
            ...buildBackingServiceView(service, appNames),
          })),
        ],
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
