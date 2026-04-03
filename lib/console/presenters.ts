import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import {
  getFugueApps,
  getFugueAuditEvents,
  getFugueOperations,
  getFugueProjects,
  getFugueRuntimes,
  getFugueTenants,
  type FugueApp,
  type FugueAuditEvent,
  type FugueOperation,
  type FugueProject,
  type FugueRuntime,
  type FugueTenant,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import type { ConsoleTone } from "@/lib/console/types";
import {
  getCurrentWorkspaceAccess,
  type WorkspaceAccess,
} from "@/lib/workspace/current";
import {
  readFugueSourceHref,
  readFugueSourceLabel,
  readFugueSourceMeta,
} from "@/lib/fugue/source-display";
import { readManagedSharedRuntimeLabel } from "@/lib/fugue/runtime-location";

const AUTO_GITHUB_SYNC_REQUESTED_BY_ID = "fugue-controller/github-sync";

export type ConsoleSummary = {
  apiHost: string;
  appCount: number;
  connectionLabel: string;
  connectionTone: ConsoleTone;
  latestActivityExact: string;
  latestActivityLabel: string;
  projectCount: number;
  publicRouteCount: number;
  runtimeCount: number;
  scopeLabel: string;
  tenantCount: number;
};

export type ConsoleAppView = {
  id: string;
  lastMessage: string;
  lastOperationLabel: string;
  name: string;
  phase: string;
  phaseTone: ConsoleTone;
  projectLabel: string;
  replicasLabel: string;
  routeHref: string | null;
  routeLabel: string;
  runtimeLabel: string;
  sourceHref: string | null;
  sourceLabel: string;
  sourceMeta: string;
  tenantLabel: string;
  updatedExact: string;
  updatedLabel: string;
};

export type ConsoleTenantView = {
  appCount: number;
  id: string;
  label: string;
  latestActivityLabel: string;
  runtimeCount: number;
};

export type ConsoleActorView = {
  eventCount: number;
  id: string;
  label: string;
  lastSeenLabel: string;
  typeLabel: string;
};

export type ConsoleWorkspaceView = {
  adminKeyLabel: string | null;
  defaultProjectId: string | null;
  defaultProjectName: string | null;
  firstAppId: string | null;
  stage: "needs-workspace" | "needs-import" | "ready";
  tenantId: string | null;
  tenantName: string | null;
};

export type ConsoleData = {
  actors: ConsoleActorView[];
  apps: ConsoleAppView[];
  errors: string[];
  summary: ConsoleSummary;
  tenants: ConsoleTenantView[];
  workspace: ConsoleWorkspaceView;
};

function formatHandle(handle: string) {
  return handle
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

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

function sortByTimestampDesc<T>(items: T[], readTimestamp: (item: T) => number) {
  return [...items].sort((left, right) => readTimestamp(right) - readTimestamp(left));
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

function readRouteLabel(app: FugueApp) {
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

function formatActorLabel(type?: string | null, id?: string | null) {
  if (!type) {
    return "Unknown actor";
  }

  const normalizedType = type.trim().toLowerCase();
  const normalizedId = id?.trim() ?? "";
  const label = humanize(type);

  if (!id) {
    return label;
  }

  if (normalizedType === "bootstrap") {
    if (normalizedId === AUTO_GITHUB_SYNC_REQUESTED_BY_ID) {
      return "GitHub sync controller";
    }

    return "Bootstrap admin";
  }

  return `${label} · ${shortId(id)}`;
}

function toneForStatus(status?: string | null): ConsoleTone {
  const normalized = status?.toLowerCase() ?? "";

  if (!normalized) {
    return "neutral";
  }

  if (
    normalized.includes("error") ||
    normalized.includes("fail") ||
    normalized.includes("stopped")
  ) {
    return "danger";
  }

  if (
    normalized.includes("queued") ||
    normalized.includes("pending") ||
    normalized.includes("migrating")
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
function readScopeLabel(workspace: WorkspaceAccess | null) {
  return workspace ? "workspace admin key" : "admin key pending";
}

function buildWorkspaceView(
  workspace: WorkspaceAccess | null,
  stage: ConsoleWorkspaceView["stage"],
  resolvedDefaultProjectName?: string | null,
): ConsoleWorkspaceView {
  return {
    adminKeyLabel: workspace?.adminKeyLabel ?? null,
    defaultProjectId: workspace?.defaultProjectId ?? null,
    defaultProjectName: resolvedDefaultProjectName ?? workspace?.defaultProjectName ?? null,
    firstAppId: workspace?.firstAppId ?? null,
    stage,
    tenantId: workspace?.tenantId ?? null,
    tenantName: workspace?.tenantName ?? null,
  };
}

function readAppTimestamp(app: FugueApp) {
  return parseTimestamp(app.status.updatedAt ?? app.updatedAt ?? app.createdAt);
}

function readRuntimeTimestamp(runtime: FugueRuntime) {
  return parseTimestamp(runtime.lastHeartbeatAt ?? runtime.lastSeenAt ?? runtime.updatedAt ?? runtime.createdAt);
}

function readOperationTimestamp(operation: FugueOperation) {
  return parseTimestamp(
    operation.completedAt ?? operation.updatedAt ?? operation.startedAt ?? operation.createdAt,
  );
}

function readAuditTimestamp(event: FugueAuditEvent) {
  return parseTimestamp(event.createdAt);
}

function readRuntimeLabel(runtime: FugueRuntime) {
  if (runtime.type === "managed-shared") {
    return readManagedSharedRuntimeLabel(runtime);
  }

  return runtime.name ?? runtime.machineName ?? shortId(runtime.id);
}

function resolveTenantLabel(
  tenantId: string | null,
  tenantNames: Map<string, string>,
) {
  if (!tenantId) {
    return "platform";
  }

  return tenantNames.get(tenantId) ?? shortId(tenantId);
}

function resolveProjectLabel(
  projectId: string | null,
  projectNames: Map<string, string>,
) {
  if (!projectId) {
    return "Unassigned";
  }

  return projectNames.get(projectId) ?? shortId(projectId);
}

function buildWorkspaceName(session: Pick<SessionUser, "email" | "name">) {
  if (session.name?.trim()) {
    return `${session.name.trim()}'s console`;
  }

  const handle = session.email.split("@")[0] ?? "Workspace";
  return `${formatHandle(handle)} console`;
}

function readSummaryConnection(errors: string[]) {
  if (!errors.length) {
    return {
      label: "Live",
      tone: "positive" as const,
    };
  }

  if (errors.length >= 4) {
    return {
      label: "Offline",
      tone: "danger" as const,
    };
  }

  return {
    label: "Partial",
    tone: "warning" as const,
  };
}

function collectTenantStats(
  apps: FugueApp[],
  runtimes: FugueRuntime[],
  operations: FugueOperation[],
  auditEvents: FugueAuditEvent[],
  tenantNames: Map<string, string>,
) {
  const stats = new Map<
    string,
    {
      appCount: number;
      id: string;
      latestTimestamp: number;
      runtimeCount: number;
    }
  >();

  function touch(id: string | null, timestamp: number, field?: "appCount" | "runtimeCount") {
    if (!id) {
      return;
    }

    const current = stats.get(id) ?? {
      appCount: 0,
      id,
      latestTimestamp: 0,
      runtimeCount: 0,
    };

    if (field) {
      current[field] += 1;
    }

    current.latestTimestamp = Math.max(current.latestTimestamp, timestamp);
    stats.set(id, current);
  }

  for (const app of apps) {
    touch(app.tenantId, readAppTimestamp(app), "appCount");
  }

  for (const runtime of runtimes) {
    touch(runtime.tenantId, readRuntimeTimestamp(runtime), "runtimeCount");
  }

  for (const operation of operations) {
    touch(operation.tenantId, readOperationTimestamp(operation));
  }

  for (const event of auditEvents) {
    touch(event.tenantId, readAuditTimestamp(event));
  }

  return [...stats.values()]
    .map((item) => ({
      appCount: item.appCount,
      id: item.id,
      label: tenantNames.get(item.id) ?? shortId(item.id),
      latestActivityLabel: item.latestTimestamp
        ? formatRelativeTime(new Date(item.latestTimestamp).toISOString())
        : "Not yet",
      runtimeCount: item.runtimeCount,
    }))
    .sort((left, right) => {
      if (right.appCount !== left.appCount) {
        return right.appCount - left.appCount;
      }

      return left.label.localeCompare(right.label);
    });
}

function collectActorStats(auditEvents: FugueAuditEvent[]) {
  const stats = new Map<
    string,
    {
      eventCount: number;
      id: string;
      label: string;
      lastSeenAt: number;
      typeLabel: string;
    }
  >();

  for (const event of auditEvents) {
    const type = event.actorType ?? "unknown";
    const id = event.actorId ?? "unknown";
    const key = `${type}:${id}`;
    const current = stats.get(key) ?? {
      eventCount: 0,
      id,
      label: formatActorLabel(type, id),
      lastSeenAt: 0,
      typeLabel: humanize(type),
    };

    current.eventCount += 1;
    current.lastSeenAt = Math.max(current.lastSeenAt, readAuditTimestamp(event));
    stats.set(key, current);
  }

  return [...stats.values()]
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
    .slice(0, 8)
    .map((item) => ({
      eventCount: item.eventCount,
      id: item.id,
      label: item.label,
      lastSeenLabel: item.lastSeenAt ? formatRelativeTime(new Date(item.lastSeenAt).toISOString()) : "Not yet",
      typeLabel: item.typeLabel,
    }));
}

export { buildWorkspaceName };

function buildUnavailableConsoleData(
  error: string,
  workspace: WorkspaceAccess | null,
): ConsoleData {
  const stage =
    !workspace
      ? "needs-workspace"
      : workspace.firstAppId
        ? "ready"
        : "needs-import";

  return {
    actors: [],
    apps: [],
    errors: [error],
    summary: {
      apiHost: "Unavailable",
      appCount: 0,
      connectionLabel: "unconfigured",
      connectionTone: "danger",
      latestActivityExact: "Not yet",
      latestActivityLabel: "Not yet",
      projectCount: 0,
      publicRouteCount: 0,
      runtimeCount: 0,
      scopeLabel: readScopeLabel(workspace),
      tenantCount: workspace?.tenantId ? 1 : 0,
    },
    tenants: [],
    workspace: buildWorkspaceView(workspace, stage),
  };
}

export async function getConsoleData(): Promise<ConsoleData> {
  let workspace: WorkspaceAccess | null = null;

  try {
    workspace = await getCurrentWorkspaceAccess();
  } catch (error) {
    return buildUnavailableConsoleData(readErrorMessage(error), null);
  }

  let env: ReturnType<typeof getFugueEnv>;

  try {
    env = getFugueEnv();
  } catch (error) {
    return buildUnavailableConsoleData(readErrorMessage(error), workspace);
  }

  if (!workspace) {
    return {
      actors: [],
      apps: [],
      errors: [],
      summary: {
        apiHost: env.apiHost,
        appCount: 0,
        connectionLabel: "idle",
        connectionTone: "neutral",
        latestActivityExact: "Not yet",
        latestActivityLabel: "Not yet",
        projectCount: 0,
        publicRouteCount: 0,
        runtimeCount: 0,
        scopeLabel: readScopeLabel(null),
        tenantCount: 0,
      },
      tenants: [],
      workspace: buildWorkspaceView(null, "needs-workspace"),
    };
  }

  const [
    tenantsResult,
    projectsResult,
    appsResult,
    runtimesResult,
    operationsResult,
    auditResult,
  ] = await Promise.allSettled([
    getFugueTenants(workspace.adminKeySecret),
    getFugueProjects(workspace.adminKeySecret),
    getFugueApps(workspace.adminKeySecret, {
      includeLiveStatus: false,
      includeResourceUsage: false,
    }),
    getFugueRuntimes(workspace.adminKeySecret),
    getFugueOperations(workspace.adminKeySecret),
    getFugueAuditEvents(workspace.adminKeySecret),
  ]);

  const errors = [
    tenantsResult.status === "rejected"
      ? `tenants: ${readErrorMessage(tenantsResult.reason)}`
      : null,
    projectsResult.status === "rejected"
      ? `projects: ${readErrorMessage(projectsResult.reason)}`
      : null,
    appsResult.status === "rejected" ? `apps: ${readErrorMessage(appsResult.reason)}` : null,
    runtimesResult.status === "rejected" ? `runtimes: ${readErrorMessage(runtimesResult.reason)}` : null,
    operationsResult.status === "rejected" ? `operations: ${readErrorMessage(operationsResult.reason)}` : null,
    auditResult.status === "rejected" ? `audit: ${readErrorMessage(auditResult.reason)}` : null,
  ].filter((value): value is string => Boolean(value));

  const tenants = tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const runtimes = runtimesResult.status === "fulfilled" ? runtimesResult.value : [];
  const operations = operationsResult.status === "fulfilled" ? operationsResult.value : [];
  const auditEvents = auditResult.status === "fulfilled" ? auditResult.value : [];

  const runtimesById = new Map(runtimes.map((item) => [item.id, item]));

  const projectNames = new Map<string, string>(
    projects.map((project) => [project.id, project.name] as const),
  );
  const tenantNames = new Map<string, string>(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  if (
    workspace.defaultProjectId &&
    workspace.defaultProjectName &&
    !projectNames.has(workspace.defaultProjectId)
  ) {
    projectNames.set(workspace.defaultProjectId, workspace.defaultProjectName);
  }

  if (workspace.tenantId && workspace.tenantName) {
    tenantNames.set(workspace.tenantId, workspace.tenantName);
  }

  const sortedOperations = sortByTimestampDesc(operations, readOperationTimestamp);
  const latestOperationByAppId = new Map<string, FugueOperation>();

  for (const operation of sortedOperations) {
    if (operation.appId && !latestOperationByAppId.has(operation.appId)) {
      latestOperationByAppId.set(operation.appId, operation);
    }
  }

  const appViews = sortByTimestampDesc(apps, readAppTimestamp).map((app) => {
    const currentRuntimeId = app.status.currentRuntimeId ?? app.spec.runtimeId;
    const runtime = currentRuntimeId ? runtimesById.get(currentRuntimeId) : undefined;
    const route = readRouteLabel(app);
    const latestOperation = latestOperationByAppId.get(app.id);
    const desiredReplicas = app.spec.disabled ? 0 : app.spec.replicas;
    const currentReplicas = app.status.currentReplicas ?? desiredReplicas;

    return {
      id: app.id,
      lastMessage: app.status.lastMessage ?? "No current status message.",
      lastOperationLabel: latestOperation
        ? `${humanize(latestOperation.type)} / ${humanize(latestOperation.status)}`
        : app.status.lastOperationId
          ? shortId(app.status.lastOperationId)
          : "No operation yet",
      name: app.name,
      phase: humanize(app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown")),
      phaseTone: toneForStatus(app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown")),
      projectLabel: resolveProjectLabel(app.projectId, projectNames),
      replicasLabel: app.spec.disabled
        ? "Disabled"
        : `${currentReplicas ?? 0} / ${desiredReplicas ?? currentReplicas ?? 0}`,
      routeHref: route.href,
      routeLabel: route.label,
      runtimeLabel: runtime ? readRuntimeLabel(runtime) : currentRuntimeId ? shortId(currentRuntimeId) : "Unassigned",
      sourceHref: readFugueSourceHref(app.source),
      sourceLabel: readFugueSourceLabel(app.source),
      sourceMeta: readFugueSourceMeta(app.source),
      tenantLabel: resolveTenantLabel(app.tenantId, tenantNames),
      updatedExact: formatExactTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
      updatedLabel: formatRelativeTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
    } satisfies ConsoleAppView;
  });

  const tenantIds = new Set<string>();
  const projectIds = new Set<string>();

  if (workspace.tenantId) {
    tenantIds.add(workspace.tenantId);
  }

  if (workspace.defaultProjectId) {
    projectIds.add(workspace.defaultProjectId);
  }

  for (const tenant of tenants) {
    tenantIds.add(tenant.id);
  }

  for (const project of projects) {
    projectIds.add(project.id);

    if (project.tenantId) {
      tenantIds.add(project.tenantId);
    }
  }

  for (const app of apps) {
    if (app.tenantId) {
      tenantIds.add(app.tenantId);
    }

    if (app.projectId) {
      projectIds.add(app.projectId);
    }
  }

  for (const runtime of runtimes) {
    if (runtime.tenantId) {
      tenantIds.add(runtime.tenantId);
    }
  }

  for (const operation of operations) {
    if (operation.tenantId) {
      tenantIds.add(operation.tenantId);
    }
  }

  for (const event of auditEvents) {
    if (event.tenantId) {
      tenantIds.add(event.tenantId);
    }
  }

  const latestActivityTimestamp = Math.max(
    0,
    ...apps.map(readAppTimestamp),
    ...runtimes.map(readRuntimeTimestamp),
    ...operations.map(readOperationTimestamp),
    ...auditEvents.map(readAuditTimestamp),
  );

  const connection = readSummaryConnection(errors);
  const latestActivityIso = latestActivityTimestamp ? new Date(latestActivityTimestamp).toISOString() : null;
  const tenantViews = collectTenantStats(apps, runtimes, operations, auditEvents, tenantNames);
  const stage =
    workspace.firstAppId || appViews.length > 0 ? "ready" : "needs-import";
  const resolvedDefaultProjectName = workspace.defaultProjectId
    ? projectNames.get(workspace.defaultProjectId) ?? workspace.defaultProjectName
    : workspace.defaultProjectName;

  return {
    actors: collectActorStats(auditEvents),
    apps: appViews,
    errors,
    summary: {
      apiHost: env.apiHost,
      appCount: appViews.length,
      connectionLabel: connection.label,
      connectionTone: connection.tone,
      latestActivityExact: formatExactTime(latestActivityIso),
      latestActivityLabel: formatRelativeTime(latestActivityIso),
      projectCount: Math.max(projectIds.size, projects.length, workspace.defaultProjectId ? 1 : 0),
      publicRouteCount: apps.filter((app) => Boolean(app.route.publicUrl || app.route.hostname)).length,
      runtimeCount: runtimes.length,
      scopeLabel: readScopeLabel(workspace),
      tenantCount: Math.max(tenantIds.size, tenants.length, workspace.tenantId ? 1 : 0),
    } satisfies ConsoleSummary,
    tenants:
      tenantViews.length > 0
        ? tenantViews.slice(0, 8)
        : workspace.tenantId
          ? [
              {
                appCount: appViews.length,
                id: workspace.tenantId,
                label: workspace.tenantName,
                latestActivityLabel: latestActivityIso
                  ? formatRelativeTime(latestActivityIso)
                  : "Not yet",
                runtimeCount: runtimes.length,
              } satisfies ConsoleTenantView,
            ]
          : [],
    workspace: buildWorkspaceView(workspace, stage, resolvedDefaultProjectName),
  } satisfies ConsoleData;
}
