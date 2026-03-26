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
  type FugueAppSource,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import type { ConsoleTone } from "@/lib/console/types";
import {
  getCurrentWorkspaceAccess,
  type WorkspaceAccess,
} from "@/lib/workspace/current";
import { readGitHubSourceHref } from "@/lib/fugue/source-links";
import { readRuntimeLocation } from "@/lib/fugue/runtime-location";

const AUTO_GITHUB_SYNC_REQUESTED_BY_ID = "fugue-controller/github-sync";

export type ConsoleSummary = {
  activeOperationCount: number;
  apiHost: string;
  appCount: number;
  connectionLabel: string;
  connectionTone: ConsoleTone;
  latestActivityExact: string;
  latestActivityLabel: string;
  ownedRuntimeCount: number;
  projectCount: number;
  publicRouteCount: number;
  runtimeCount: number;
  scopeLabel: string;
  sharedRuntimeCount: number;
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

export type ConsoleRuntimeView = {
  activityExact: string;
  activityLabel: string;
  appCount: number;
  clusterNodeLabel: string;
  detail: string;
  endpointLabel: string;
  fingerprintLabel: string;
  id: string;
  kindLabel: string;
  label: string;
  locationCountryCode: string | null;
  locationLabel: string | null;
  status: string;
  statusTone: ConsoleTone;
  tenantLabel: string;
};

export type ConsoleOperationView = {
  actionLabel: string;
  actorLabel: string;
  detail: string;
  id: string;
  status: string;
  statusTone: ConsoleTone;
  targetLabel: string;
  tenantLabel: string;
  timestampExact: string;
  timestampLabel: string;
};

export type ConsoleAuditView = {
  action: string;
  actorLabel: string;
  detail: string;
  id: string;
  scopeLabel: string;
  targetLabel: string;
  timestampExact: string;
  timestampLabel: string;
  tone: ConsoleTone;
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
  activeOperations: ConsoleOperationView[];
  actors: ConsoleActorView[];
  apps: ConsoleAppView[];
  errors: string[];
  recentAuditEvents: ConsoleAuditView[];
  recentOperations: ConsoleOperationView[];
  runtimeAuditEvents: ConsoleAuditView[];
  runtimes: ConsoleRuntimeView[];
  summary: ConsoleSummary;
  tenants: ConsoleTenantView[];
  workspace: ConsoleWorkspaceView;
};

const terminalOperationStatuses = new Set(["canceled", "cancelled", "completed", "failed"]);

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

function shortCommitSha(value?: string | null) {
  const commit = value?.trim();

  if (!commit) {
    return "";
  }

  return commit.length > 8 ? commit.slice(0, 8) : commit;
}

function joinFragments(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" / ");
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

function isGitHubSyncOperation(operation: FugueOperation) {
  return (
    operation.requestedByType?.trim().toLowerCase() === "bootstrap" &&
    operation.requestedById?.trim() === AUTO_GITHUB_SYNC_REQUESTED_BY_ID
  );
}

function readOperationSourceLabel(source?: FugueAppSource | null) {
  if (!source) {
    return "";
  }

  if (source.repoUrl) {
    return joinFragments([
      formatRepoLabel(source.repoUrl, source.repoBranch),
      source.commitSha ? `commit ${shortCommitSha(source.commitSha)}` : null,
    ]);
  }

  if (source.type?.trim().toLowerCase() === "upload") {
    return source.uploadFilename?.trim()
      ? `Upload · ${source.uploadFilename.trim()}`
      : "Upload source";
  }

  return humanize(source.type);
}

function formatOperationActionLabel(operation: FugueOperation) {
  if (operation.type?.trim().toLowerCase() === "import" && isGitHubSyncOperation(operation)) {
    return "GitHub sync";
  }

  return humanize(operation.type);
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

function toneForAuditAction(action?: string | null): ConsoleTone {
  const normalized = action?.toLowerCase() ?? "";

  if (!normalized) {
    return "neutral";
  }

  if (normalized.includes("delete")) {
    return "warning";
  }

  if (normalized.includes("create") || normalized.includes("join_cluster")) {
    return "positive";
  }

  if (
    normalized.includes("patch") ||
    normalized.includes("import") ||
    normalized.includes("rebuild") ||
    normalized.includes("runtime_logs") ||
    normalized.includes("build_logs")
  ) {
    return "info";
  }

  return "neutral";
}

function isActiveOperation(status?: string | null) {
  return !terminalOperationStatuses.has(status?.toLowerCase() ?? "");
}

function readScopeLabel(workspace: WorkspaceAccess | null) {
  return workspace ? "workspace admin key" : "admin key pending";
}

function buildWorkspaceView(
  workspace: WorkspaceAccess | null,
  stage: ConsoleWorkspaceView["stage"],
): ConsoleWorkspaceView {
  return {
    adminKeyLabel: workspace?.adminKeyLabel ?? null,
    defaultProjectId: workspace?.defaultProjectId ?? null,
    defaultProjectName: workspace?.defaultProjectName ?? null,
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
    return `Internal cluster / ${readRuntimeLocation(runtime.labels).locationLabel ?? "Global"}`;
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

function buildRuntimeDetail(runtime: FugueRuntime) {
  const location = readRuntimeLocation(runtime.labels);

  if (runtime.type === "managed-shared") {
    return location.locationLabel
      ? `Shared ingress and scheduler path managed by Fugue. Region pinned to ${location.locationLabel}.`
      : "Shared ingress and scheduler path managed by Fugue. Default shared pool without region pinning.";
  }

  const fragments = [
    location.locationLabel ? `location ${location.locationLabel}` : null,
    runtime.lastHeartbeatAt
      ? `heartbeat ${formatRelativeTime(runtime.lastHeartbeatAt)}`
      : runtime.lastSeenAt
        ? `last seen ${formatRelativeTime(runtime.lastSeenAt)}`
        : "heartbeat unavailable",
    runtime.endpoint ? `endpoint ${runtime.endpoint}` : null,
    runtime.clusterNodeName ? `node ${runtime.clusterNodeName}` : null,
  ].filter(Boolean);

  return fragments.join(" / ");
}

function buildOperationDetail(
  operation: FugueOperation,
  sourceRuntime: FugueRuntime | undefined,
  targetRuntime: FugueRuntime | undefined,
) {
  const sourceLabel = readOperationSourceLabel(operation.desiredSource);

  if (operation.errorMessage) {
    return joinFragments([sourceLabel, operation.errorMessage]);
  }

  if (operation.resultMessage) {
    return joinFragments([sourceLabel, operation.resultMessage]);
  }

  if (isGitHubSyncOperation(operation)) {
    return joinFragments([
      sourceLabel,
      "Queued automatically after the tracked GitHub branch changed.",
    ]);
  }

  if (operation.type?.trim().toLowerCase() === "deploy") {
    return joinFragments([
      sourceLabel,
      isActiveOperation(operation.status)
        ? "Waiting for rollout ready before completion."
        : "Completed after rollout ready.",
    ]);
  }

  if (sourceRuntime && targetRuntime && sourceRuntime.id !== targetRuntime.id) {
    return `${readRuntimeLabel(sourceRuntime)} -> ${readRuntimeLabel(targetRuntime)}`;
  }

  if (targetRuntime) {
    return `Target runtime ${readRuntimeLabel(targetRuntime)}`;
  }

  if (sourceLabel) {
    return sourceLabel;
  }

  if (operation.executionMode) {
    return `${humanize(operation.executionMode)} execution`;
  }

  return "No result message yet.";
}

function buildAuditDetail(event: FugueAuditEvent, appsById: Map<string, FugueApp>) {
  if (event.metadata.hostname) {
    return event.metadata.hostname;
  }

  if (event.metadata.repoUrl) {
    return formatRepoLabel(event.metadata.repoUrl, null);
  }

  if (event.metadata.name) {
    return event.metadata.name;
  }

  if (event.metadata.appId) {
    return appsById.get(event.metadata.appId)?.name ?? shortId(event.metadata.appId);
  }

  if (event.metadata.component) {
    return humanize(event.metadata.component);
  }

  return shortId(event.targetId);
}

function resolveAuditTarget(
  event: FugueAuditEvent,
  appsById: Map<string, FugueApp>,
  runtimesById: Map<string, FugueRuntime>,
  projectNames: Map<string, string>,
  tenantNames: Map<string, string>,
) {
  if (event.targetType === "app" && event.targetId) {
    return appsById.get(event.targetId)?.name ?? shortId(event.targetId);
  }

  if (event.targetType === "node" && event.targetId) {
    const runtime = runtimesById.get(event.targetId);
    return runtime ? readRuntimeLabel(runtime) : shortId(event.targetId);
  }

  if (event.targetType === "project" && event.targetId) {
    return projectNames.get(event.targetId) ?? shortId(event.targetId);
  }

  if (event.targetType === "tenant" && event.targetId) {
    return tenantNames.get(event.targetId) ?? shortId(event.targetId);
  }

  if (event.metadata.appId) {
    return appsById.get(event.metadata.appId)?.name ?? shortId(event.metadata.appId);
  }

  if (event.targetId) {
    return shortId(event.targetId);
  }

  return "Control plane";
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
    activeOperations: [],
    actors: [],
    apps: [],
    errors: [error],
    recentAuditEvents: [],
    recentOperations: [],
    runtimeAuditEvents: [],
    runtimes: [],
    summary: {
      activeOperationCount: 0,
      apiHost: "Unavailable",
      appCount: 0,
      connectionLabel: "unconfigured",
      connectionTone: "danger",
      latestActivityExact: "Not yet",
      latestActivityLabel: "Not yet",
      ownedRuntimeCount: 0,
      projectCount: 0,
      publicRouteCount: 0,
      runtimeCount: 0,
      scopeLabel: readScopeLabel(workspace),
      sharedRuntimeCount: 0,
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
      activeOperations: [],
      actors: [],
      apps: [],
      errors: [],
      recentAuditEvents: [],
      recentOperations: [],
      runtimeAuditEvents: [],
      runtimes: [],
      summary: {
        activeOperationCount: 0,
        apiHost: env.apiHost,
        appCount: 0,
        connectionLabel: "idle",
        connectionTone: "neutral",
        latestActivityExact: "Not yet",
        latestActivityLabel: "Not yet",
        ownedRuntimeCount: 0,
        projectCount: 0,
        publicRouteCount: 0,
        runtimeCount: 0,
        scopeLabel: readScopeLabel(null),
        sharedRuntimeCount: 0,
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
    getFugueApps(workspace.adminKeySecret),
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

  const appsById = new Map(apps.map((item) => [item.id, item]));
  const runtimesById = new Map(runtimes.map((item) => [item.id, item]));

  const projectNames = new Map<string, string>(
    projects.map((project) => [project.id, project.name] as const),
  );
  const tenantNames = new Map<string, string>(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  if (workspace.defaultProjectId && workspace.defaultProjectName) {
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

  const appCountByRuntime = new Map<string, number>();

  for (const app of apps) {
    const runtimeId = app.status.currentRuntimeId ?? app.spec.runtimeId;

    if (!runtimeId) {
      continue;
    }

    appCountByRuntime.set(runtimeId, (appCountByRuntime.get(runtimeId) ?? 0) + 1);
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
      sourceHref: readGitHubSourceHref(app.source.repoUrl),
      sourceLabel: formatRepoLabel(app.source.repoUrl, app.source.repoBranch),
      sourceMeta:
        [humanize(app.source.buildStrategy), app.source.composeService, app.source.dockerfilePath]
          .filter((value) => value && value !== "Unknown")
          .join(" / ") || humanize(app.source.type),
      tenantLabel: resolveTenantLabel(app.tenantId, tenantNames),
      updatedExact: formatExactTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
      updatedLabel: formatRelativeTime(app.status.updatedAt ?? app.updatedAt ?? app.createdAt),
    } satisfies ConsoleAppView;
  });

  const runtimeViews = sortByTimestampDesc(runtimes, readRuntimeTimestamp).map((runtime) => {
    const activityAt = runtime.lastHeartbeatAt ?? runtime.lastSeenAt ?? runtime.updatedAt ?? runtime.createdAt;
    const location = readRuntimeLocation(runtime.labels);

    return {
      activityExact: formatExactTime(activityAt),
      activityLabel: formatRelativeTime(activityAt),
      appCount: appCountByRuntime.get(runtime.id) ?? 0,
      clusterNodeLabel: runtime.clusterNodeName ?? "—",
      detail: buildRuntimeDetail(runtime),
      endpointLabel: runtime.endpoint ?? "—",
      fingerprintLabel: runtime.fingerprintPrefix ?? "—",
      id: runtime.id,
      kindLabel:
        runtime.type === "managed-shared"
          ? "Internal cluster"
          : runtime.connectionMode
            ? humanize(runtime.connectionMode)
            : humanize(runtime.type),
      label: readRuntimeLabel(runtime),
      locationCountryCode: location.locationCountryCode,
      locationLabel:
        runtime.type === "managed-shared"
          ? location.locationLabel ?? "Global"
          : location.locationLabel,
      status: humanize(runtime.status),
      statusTone: toneForStatus(runtime.status),
      tenantLabel: resolveTenantLabel(runtime.tenantId, tenantNames),
    } satisfies ConsoleRuntimeView;
  });

  const operationViews = sortedOperations.map((operation) => {
    const sourceRuntime = operation.sourceRuntimeId
      ? runtimesById.get(operation.sourceRuntimeId)
      : undefined;
    const targetRuntime = operation.targetRuntimeId
      ? runtimesById.get(operation.targetRuntimeId)
      : undefined;
    const targetApp = operation.appId ? appsById.get(operation.appId) : undefined;

    return {
      actionLabel: formatOperationActionLabel(operation),
      actorLabel: formatActorLabel(operation.requestedByType, operation.requestedById),
      detail: buildOperationDetail(operation, sourceRuntime, targetRuntime),
      id: operation.id,
      status: humanize(operation.status),
      statusTone: toneForStatus(operation.status),
      targetLabel:
        targetApp?.name ??
        (sourceRuntime && targetRuntime && sourceRuntime.id !== targetRuntime.id
          ? `${readRuntimeLabel(sourceRuntime)} -> ${readRuntimeLabel(targetRuntime)}`
          : targetRuntime
            ? readRuntimeLabel(targetRuntime)
            : operation.appId
              ? shortId(operation.appId)
              : "Control plane"),
      tenantLabel: resolveTenantLabel(operation.tenantId, tenantNames),
      timestampExact: formatExactTime(
        operation.completedAt ?? operation.updatedAt ?? operation.startedAt ?? operation.createdAt,
      ),
      timestampLabel: formatRelativeTime(
        operation.completedAt ?? operation.updatedAt ?? operation.startedAt ?? operation.createdAt,
      ),
    } satisfies ConsoleOperationView;
  });

  const auditViews = sortByTimestampDesc(auditEvents, readAuditTimestamp).map((event) => ({
    action: humanize(event.action),
    actorLabel: formatActorLabel(event.actorType, event.actorId),
    detail: buildAuditDetail(event, appsById),
    id: event.id,
    scopeLabel: resolveTenantLabel(event.tenantId, tenantNames),
    targetLabel: resolveAuditTarget(event, appsById, runtimesById, projectNames, tenantNames),
    timestampExact: formatExactTime(event.createdAt),
    timestampLabel: formatRelativeTime(event.createdAt),
    tone: toneForAuditAction(event.action),
  }));

  const recentAuditEvents = auditViews.slice(0, 12);
  const runtimeAuditEvents = auditViews.filter((event) => event.action.startsWith("node.")).slice(0, 8);
  const activeOperations = operationViews.filter((operation) => isActiveOperation(operation.status)).slice(0, 8);
  const recentOperations = operationViews.slice(0, 12);

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

  return {
    activeOperations,
    actors: collectActorStats(auditEvents),
    apps: appViews,
    errors,
    recentAuditEvents,
    recentOperations,
    runtimeAuditEvents,
    runtimes: runtimeViews,
    summary: {
      activeOperationCount: activeOperations.length,
      apiHost: env.apiHost,
      appCount: appViews.length,
      connectionLabel: connection.label,
      connectionTone: connection.tone,
      latestActivityExact: formatExactTime(latestActivityIso),
      latestActivityLabel: formatRelativeTime(latestActivityIso),
      ownedRuntimeCount: runtimes.filter((runtime) => runtime.type !== "managed-shared").length,
      projectCount: Math.max(projectIds.size, projects.length, workspace.defaultProjectId ? 1 : 0),
      publicRouteCount: apps.filter((app) => Boolean(app.route.publicUrl || app.route.hostname)).length,
      runtimeCount: runtimeViews.length,
      scopeLabel: readScopeLabel(workspace),
      sharedRuntimeCount: runtimes.filter((runtime) => runtime.type === "managed-shared").length,
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
                runtimeCount: runtimeViews.length,
              } satisfies ConsoleTenantView,
            ]
          : [],
    workspace: buildWorkspaceView(workspace, stage),
  } satisfies ConsoleData;
}
