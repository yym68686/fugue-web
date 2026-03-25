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
  getFugueRuntimes,
  type FugueApp,
  type FugueBackingService,
  type FugueProject,
  type FugueRuntime,
} from "@/lib/fugue/api";
import { getCurrentWorkspaceAccess } from "@/lib/workspace/current";

function readErrorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }

  return "Unknown Fugue API error.";
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

function buildAppBadges(app: FugueApp): ConsoleGalleryBadgeView[] {
  const badges: ConsoleGalleryBadgeView[] = [];
  const sourceType = app.source.type?.toLowerCase() ?? "";
  const buildStrategy = app.source.buildStrategy?.toLowerCase() ?? "";

  if (sourceType === "github-public") {
    badges.push({
      id: readBadgeKey("github", app.name),
      kind: "github",
      label: "GitHub",
      meta: "source",
    });
  }

  if (buildStrategy === "dockerfile") {
    badges.push({
      id: readBadgeKey("docker", app.name),
      kind: "docker",
      label: "Docker",
      meta: "build",
    });
  } else if (buildStrategy === "buildpacks") {
    badges.push({
      id: readBadgeKey("buildpacks", app.name),
      kind: "buildpacks",
      label: "Buildpacks",
      meta: "build",
    });
  } else if (buildStrategy === "nixpacks") {
    badges.push({
      id: readBadgeKey("nixpacks", app.name),
      kind: "nixpacks",
      label: "Nixpacks",
      meta: "build",
    });
  } else if (buildStrategy === "static-site") {
    badges.push({
      id: readBadgeKey("static", app.name),
      kind: "static",
      label: "Static",
      meta: "build",
    });
  }

  if (app.backingServices.some((service) => service.type === "postgres")) {
    badges.push({
      id: readBadgeKey("postgres", app.name),
      kind: "postgres",
      label: "Postgres",
      meta: "service",
    });
  }

  if (!badges.length) {
    badges.push({
      id: readBadgeKey("runtime", app.name),
      kind: "runtime",
      label: humanize(app.source.type),
      meta: "service",
    });
  }

  return badges;
}

function buildProjectBadges(
  apps: FugueApp[],
  runtimesById: Map<string, FugueRuntime>,
) {
  const badges = new Map<string, ConsoleGalleryBadgeView>();

  for (const app of apps) {
    for (const badge of buildAppBadges(app)) {
      badges.set(badge.id, badge);
    }

    const runtimeId = app.status.currentRuntimeId ?? app.spec.runtimeId;
    const runtime = runtimeId ? runtimesById.get(runtimeId) : null;

    if (runtime?.type === "managed-shared") {
      const badge = {
        id: readBadgeKey("runtime", "shared"),
        kind: "runtime" as const,
        label: "Shared",
        meta: "runtime",
      };
      badges.set(badge.id, badge);
    }
  }

  return [...badges.values()].slice(0, 6);
}

function buildAppView(app: FugueApp): ConsoleGalleryAppView {
  const route = readRoute(app);

  return {
    hasPostgresService: app.backingServices.some((service) => service.type === "postgres"),
    id: app.id,
    lastMessage: app.status.lastMessage ?? "No current status message.",
    name: app.name,
    phase: app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown"),
    phaseTone: toneForStatus(app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown")),
    routeHref: route.href,
    routeLabel: route.label,
    serviceBadges: buildAppBadges(app),
    sourceLabel: formatRepoLabel(app.source.repoUrl, app.source.repoBranch),
    sourceMeta:
      [humanize(app.source.buildStrategy), app.source.composeService, app.source.dockerfilePath]
        .filter((value) => value && value !== "Unknown")
        .join(" / ") || humanize(app.source.type),
    updatedExact: formatExactTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
    updatedLabel: formatRelativeTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
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
    status: service.status ?? "unknown",
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

  const [projectsResult, appsResult, runtimesResult] = await Promise.allSettled([
    getFugueProjects(workspace.adminKeySecret, workspace.tenantId ?? undefined),
    getFugueApps(workspace.adminKeySecret),
    getFugueRuntimes(workspace.adminKeySecret),
  ]);

  const errors = [
    projectsResult.status === "rejected"
      ? `projects: ${readErrorMessage(projectsResult.reason)}`
      : null,
    appsResult.status === "rejected"
      ? `apps: ${readErrorMessage(appsResult.reason)}`
      : null,
    runtimesResult.status === "rejected"
      ? `runtimes: ${readErrorMessage(runtimesResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const runtimes = runtimesResult.status === "fulfilled" ? runtimesResult.value : [];
  const runtimesById = new Map(runtimes.map((runtime) => [runtime.id, runtime]));
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
        serviceBadges: buildProjectBadges(sortedApps, runtimesById),
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
