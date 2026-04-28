import "server-only";

import { listAppUsers, type AppUserRecord } from "@/lib/app-users/store";
import {
  deleteAdminSnapshotCache,
  readAdminSnapshotCache,
  writeAdminSnapshotCache,
} from "@/lib/admin/snapshot-store";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import {
  createFugueNodeKey,
  getFugueBillingSummary,
  getFugueApps,
  getFugueClusterNodes,
  getFugueControlPlaneStatus,
  getFugueProjectImageUsage,
  getFugueProjects,
  getFugueRuntimes,
  getFugueTenants,
  setFugueClusterNodePolicy,
  setFugueBillingBalance,
  updateFugueBilling,
  type FugueApp,
  type FugueBillingPriceBook,
  type FugueBillingSummary,
  type FugueClusterNode,
  type FugueClusterNodeCPUStats,
  type FugueClusterNodeMemoryStats,
  type FugueClusterNodeStorageStats,
  type FugueClusterNodeWorkload,
  type FugueControlPlaneComponent,
  type FugueControlPlaneStatus,
  type FugueProject,
  type FugueProjectImageUsageAppSummary,
  type FugueProjectImageUsageResult,
  type FugueResourceSpec,
  type FugueRuntime,
  type FugueTenant,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import {
  readFugueSourceHref,
  readFugueSourceLabel,
} from "@/lib/fugue/source-display";
import {
  readTechStackBadgeKind,
  readTechnologyLabel,
  type TechStackBadgeKind,
} from "@/lib/tech-stack";
import { readCountryLocation } from "@/lib/geo/country";
import { createExpiringAsyncCache } from "@/lib/server/expiring-async-cache";
import {
  getWorkspaceSnapshotByEmail,
  listWorkspaceSnapshots,
  type WorkspaceSnapshot,
} from "@/lib/workspace/store";

export type AdminClusterAppView = {
  canRebuild: boolean;
  createdExact: string;
  createdLabel: string;
  id: string;
  name: string;
  ownerLabel: string;
  phase: string;
  phaseTone: ConsoleTone;
  projectLabel: string;
  resourceUsage: ConsoleCompactResourceItemView[];
  routeHref: string | null;
  routeLabel: string;
  serverLabel: string;
  sourceHref: string | null;
  sourceLabel: string;
  stack: Array<{
    id: string;
    kind: string;
    label: string;
    logoKind: TechStackBadgeKind | null;
    meta: string;
    title: string;
  }>;
};

export type AdminAppsPageData = {
  apps: AdminClusterAppView[];
  errors: string[];
  summary: {
    appCount: number;
    latestUpdateLabel: string;
    routedCount: number;
    tenantCount: number;
  };
};

export type AdminUserView = {
  billing: AdminUserBillingView;
  canBlock: boolean;
  canDemoteAdmin: boolean;
  canDelete: boolean;
  canPromoteToAdmin: boolean;
  canUnblock: boolean;
  email: string;
  isAdmin: boolean;
  lastLoginExact: string;
  lastLoginLabel: string;
  name: string;
  provider: string;
  serviceCount: number;
  status: string;
  statusTone: ConsoleTone;
  usage: AdminUserServiceUsageView;
  verified: boolean;
  workspace: AdminUserWorkspaceView | null;
};

export type AdminUserWorkspaceView = {
  adminKeyLabel: string | null;
  defaultProjectId: string | null;
  defaultProjectName: string | null;
  firstAppId: string | null;
  tenantId: string | null;
  tenantName: string | null;
};

export type AdminUserBillingView = {
  balanceLabel: string | null;
  balanceMicroCents: number | null;
  committedStorageGibibytes: number | null;
  cpuMillicores: number | null;
  limitLabel: string;
  loadError: string | null;
  loading: boolean;
  memoryMebibytes: number | null;
  monthlyEstimateLabel: string | null;
  priceBook: FugueBillingPriceBook | null;
  storageGibibytes: number | null;
  statusLabel: string | null;
  statusReason: string | null;
  statusTone: ConsoleTone;
  tenantId: string | null;
};

export type AdminUserServiceUsageView = {
  cpuLabel: string;
  diskLabel: string;
  imageLabel: string;
  loading: boolean;
  memoryLabel: string;
  serviceCount: number;
  serviceCountLabel: string;
};

export type AdminAppsUsageData = {
  apps: Array<{
    id: string;
    resourceUsage: ConsoleCompactResourceItemView[];
  }>;
  pending?: boolean;
};

export type AdminUsersUsageData = {
  pending?: boolean;
  users: Array<{
    email: string;
    serviceCount: number;
    usage: AdminUserServiceUsageView;
  }>;
};

export type AdminUsersPageData = {
  enrichmentState: "pending" | "ready";
  errors: string[];
  summary: {
    adminCount: number;
    blockedCount: number;
    deletedCount: number;
    userCount: number;
  };
  users: AdminUserView[];
};

type AdminUsersBaseData = {
  errors: string[];
  users: AppUserRecord[];
  workspaces: WorkspaceSnapshot[];
};

type AdminUsersEnrichmentLookup = {
  appImageUsage: AdminAppImageUsageLookup;
  apps: FugueApp[];
  billingByTenant: Map<string, AdminTenantBillingLookup>;
  loaded: boolean;
};

const ADMIN_USERS_ENRICHMENT_CACHE_TTL_MS = 300_000;
const ADMIN_USAGE_CACHE_TTL_MS = 300_000;
const ADMIN_USAGE_PERSISTED_STALE_MS = 30 * 60_000;
const ADMIN_CONTROL_PLANE_CACHE_TTL_MS = 300_000;
const ADMIN_APPS_PAGE_DATA_CACHE_KEY = "admin-apps-page-data";
const ADMIN_APPS_USAGE_DATA_CACHE_KEY = "admin-apps-usage-data";
const ADMIN_USERS_PAGE_DATA_CACHE_KEY = "admin-users-page-data";
const ADMIN_USERS_USAGE_DATA_CACHE_KEY = "admin-users-usage-data";

let cachedAdminUsersEnrichmentData: AdminUsersPageData | null = null;
let cachedAdminUsersEnrichmentAt = 0;
let adminUsersEnrichmentRequest: Promise<AdminUsersPageData> | null = null;
let adminAppsPageRefreshRequest: Promise<AdminAppsPageData> | null = null;
let adminAppsUsageRefreshRequest: Promise<AdminAppsUsageData> | null = null;
let adminUsersPageRefreshRequest: Promise<AdminUsersPageData> | null = null;
let adminUsersUsageRefreshRequest: Promise<AdminUsersUsageData> | null = null;
const adminAppsPageDataCache =
  createExpiringAsyncCache<AdminAppsPageData>(ADMIN_USAGE_CACHE_TTL_MS);
const adminAppsUsageCache = createExpiringAsyncCache<FugueApp[]>(
  ADMIN_USAGE_CACHE_TTL_MS,
);
const adminAppImageUsageCache =
  createExpiringAsyncCache<FugueProjectImageUsageResult | null>(
    ADMIN_USAGE_CACHE_TTL_MS,
  );
const adminAppsUsageDataCache =
  createExpiringAsyncCache<AdminAppsUsageData>(ADMIN_USAGE_CACHE_TTL_MS);
const adminUsersUsageDataCache =
  createExpiringAsyncCache<AdminUsersUsageData>(ADMIN_USAGE_CACHE_TTL_MS);
const adminUsersPageDataCache =
  createExpiringAsyncCache<AdminUsersPageData>(ADMIN_USAGE_CACHE_TTL_MS);
const adminControlPlaneViewCache =
  createExpiringAsyncCache<AdminControlPlaneView>(
    ADMIN_CONTROL_PLANE_CACHE_TTL_MS,
  );

export type AdminClusterConditionView = {
  detailLabel: string;
  id: string;
  label: string;
  lastTransitionExact: string;
  lastTransitionLabel: string;
  statusLabel: string;
  tone: ConsoleTone;
};

export type AdminClusterResourceView = {
  detailLabel: string;
  id: "cpu" | "memory" | "storage";
  label: string;
  percentLabel: string;
  percentValue: number | null;
  statusLabel: string;
  statusTone: ConsoleTone;
  totalLabel: string;
  usageLabel: string;
};

export type AdminClusterWorkloadView = {
  id: string;
  kindLabel: string;
  kindTone: ConsoleTone;
  metaLabel: string;
  name: string;
  title: string;
};

export type AdminClusterNodeView = {
  appCount: number;
  canManagePolicy: boolean;
  conditions: AdminClusterConditionView[];
  createdExact: string;
  createdLabel: string;
  headerMeta: string;
  internalIpLabel: string;
  locationCountryCode: string | null;
  locationLabel: string;
  machine: AdminClusterNodeMachineView | null;
  name: string;
  policy: AdminClusterNodePolicyView | null;
  publicIpLabel: string;
  roleLabels: string[];
  resources: AdminClusterResourceView[];
  runtimeLabel: string;
  serviceCount: number;
  statusDetail?: string | null;
  statusLabel: string;
  statusTone: ConsoleTone;
  tenantLabel: string;
  workloadCount: number;
  workloads: AdminClusterWorkloadView[];
  zoneLabel: string;
};

export type AdminClusterNodeMachineView = {
  connectionMode: string | null;
  connectionModeLabel: string;
  id: string | null;
  nodeKeyId: string | null;
  nodeKeyLabel: string;
  scope: string | null;
  scopeLabel: string;
  status: string | null;
  statusLabel: string;
};

export type AdminClusterNodePolicyView = {
  allowBuilds: boolean;
  allowSharedPool: boolean;
  desiredControlPlaneRole: string | null;
  desiredControlPlaneRoleLabel: string;
  effectiveBuilds: boolean;
  effectiveControlPlaneRole: string | null;
  effectiveControlPlaneRoleLabel: string;
  effectiveSharedPool: boolean;
};

export type AdminControlPlaneComponentView = {
  component: string;
  componentLabel: string;
  deploymentName: string;
  imageExact: string;
  imageRepositoryLabel: string;
  imageTagExact: string;
  imageTagLabel: string;
  replicaLabel: string;
  rolloutLabel: string;
  statusLabel: string;
  statusTone: ConsoleTone;
};

export type AdminControlPlaneView = {
  components: AdminControlPlaneComponentView[];
  namespaceLabel: string;
  observedExact: string;
  observedLabel: string;
  releaseInstanceLabel: string;
  statusLabel: string;
  statusTone: ConsoleTone;
  summaryLabel: string;
  versionExact: string;
  versionLabel: string;
};

export type AdminClusterPageData = {
  controlPlane: AdminControlPlaneView | null;
  errors: string[];
  nodes: AdminClusterNodeView[];
  summary: {
    nodeCount: number;
    pressuredCount: number;
    readyCount: number;
    workloadCount: number;
  };
};

export type AdminPlatformNodeEnrollmentResult = {
  joinCommand: string;
  nodeKey: {
    createdAt: string | null;
    id: string;
    label: string;
    scope: string | null;
    status: string | null;
  };
};

const REBUILDABLE_APP_SOURCE_TYPES = new Set([
  "docker-image",
  "github-private",
  "github-public",
  "upload",
]);
const CLUSTER_READY_CONDITION = "Ready";
const CLUSTER_MEMORY_PRESSURE_CONDITION = "MemoryPressure";
const CLUSTER_DISK_PRESSURE_CONDITION = "DiskPressure";
const CLUSTER_PID_PRESSURE_CONDITION = "PIDPressure";
const CONTROL_PLANE_COMPONENT_ORDER = new Map([
  ["api", 0],
  ["controller", 1],
]);
const MICRO_CENTS_PER_DOLLAR = 100_000_000;
// Keep optional admin-side enrichments from dragging first-paint snapshots past
// the 1s budget when control-plane reads are cold.
const ADMIN_OPTIONAL_FETCH_TIMEOUT_MS = 200;

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
}

type SettledResult<T> =
  | {
      status: "fulfilled";
      value: T;
    }
  | {
      reason: unknown;
      status: "rejected";
    };

type TimedSettledResult<T> =
  | SettledResult<T>
  | {
      status: "timed-out";
    };

function settleResult<T>(promise: Promise<T>): Promise<SettledResult<T>> {
  return promise.then(
    (value) =>
      ({
        status: "fulfilled",
        value,
      }) satisfies SettledResult<T>,
    (reason: unknown) =>
      ({
        reason,
        status: "rejected",
      }) satisfies SettledResult<T>,
  );
}

async function settleWithSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<TimedSettledResult<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      settleResult(promise),
      new Promise<TimedSettledResult<T>>((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve({
            status: "timed-out",
          });
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
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

function shortId(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function shortControlPlaneVersion(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return "Unavailable";
  }
  if (/^[0-9a-f]{12,}$/i.test(normalized)) {
    return normalized.slice(0, 12);
  }
  if (normalized.length <= 22) {
    return normalized;
  }
  return `${normalized.slice(0, 14)}…${normalized.slice(-6)}`;
}

function normalizeNodeKeyLabel(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildPlatformJoinCommand(apiBaseUrl: string, secret: string) {
  return `curl -fsSL ${apiBaseUrl}/install/join-cluster.sh | sudo FUGUE_NODE_KEY='${secret}' bash`;
}

function shortImageRepository(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return "Unknown image";
  }
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1) ?? normalized;
}

function readProviderLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    case "email":
      return "Email";
    default:
      return readTechnologyLabel(value);
  }
}

function normalizeTechKind(value?: string | null) {
  return value?.trim().toLowerCase() || "stack";
}

function canRebuildApp(app: FugueApp) {
  const sourceType = app.source.type?.trim().toLowerCase() ?? "";
  return REBUILDABLE_APP_SOURCE_TYPES.has(sourceType);
}

function readControlPlaneTone(value?: string | null): ConsoleTone {
  switch (value?.trim().toLowerCase()) {
    case "ready":
      return "positive";
    case "rolling":
      return "info";
    case "mixed":
      return "warning";
    case "degraded":
    case "missing":
      return "danger";
    default:
      return "neutral";
  }
}

function readControlPlaneOverviewStatusLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "ready":
      return "Synced";
    case "rolling":
      return "Rolling";
    case "mixed":
      return "Mixed";
    case "degraded":
      return "Attention";
    case "missing":
      return "Missing";
    default:
      return humanize(value);
  }
}

function readControlPlaneComponentStatusLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "ready":
      return "Ready";
    case "rolling":
      return "Rolling";
    case "mixed":
      return "Mixed";
    case "degraded":
      return "Attention";
    case "missing":
      return "Missing";
    default:
      return humanize(value);
  }
}

function readControlPlaneVersionLabel(
  status?: string | null,
  version?: string | null,
) {
  if (version?.trim()) {
    return `Release ${shortControlPlaneVersion(version)}`;
  }

  switch (status?.trim().toLowerCase()) {
    case "mixed":
      return "Mixed release";
    case "rolling":
      return "Rolling release";
    default:
      return "Version unavailable";
  }
}

function readControlPlaneSummaryLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "ready":
      return "API and controller report the same deployed image tag, with every replica updated and available.";
    case "rolling":
      return "At least one control plane deployment is still reconciling replicas or has not converged on a single image tag yet.";
    case "mixed":
      return "API and controller are healthy, but they currently advertise different deployed image tags.";
    case "degraded":
    case "missing":
      return "One or more control plane deployments are missing or below the desired rollout state.";
    default:
      return "Current control plane rollout details from the in-cluster API.";
  }
}

function readControlPlaneComponentLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "api":
      return "API";
    case "controller":
      return "Controller";
    default:
      return humanize(value);
  }
}

function buildAppStack(app: FugueApp) {
  const seen = new Set<string>();
  const items: AdminClusterAppView["stack"] = [];

  const addItem = (
    kind: string | null | undefined,
    slug: string | null | undefined,
    label: string | null | undefined,
    source?: string | null,
  ) => {
    const normalizedKind = normalizeTechKind(kind);
    const normalizedSlug =
      slug?.trim().toLowerCase() || label?.trim().toLowerCase() || "";
    const normalizedLabel = label?.trim();

    if (!normalizedSlug || !normalizedLabel) {
      return;
    }

    const key = `${normalizedKind}:${normalizedSlug}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    const kindLabel = humanize(normalizedKind);

    items.push({
      id: key,
      kind: normalizedKind,
      label: normalizedLabel,
      logoKind: readTechStackBadgeKind(normalizedKind, normalizedSlug),
      meta: kindLabel,
      title: source?.trim()
        ? `${normalizedLabel} / ${kindLabel} / ${source.trim()}`
        : `${normalizedLabel} / ${kindLabel}`,
    });
  };

  if (app.techStack.length) {
    for (const item of app.techStack) {
      addItem(item.kind, item.slug, item.name, item.source);
    }
  } else {
    addItem(
      "language",
      app.source.detectedProvider,
      app.source.detectedProvider
        ? (readTechnologyLabel(app.source.detectedProvider) ??
            humanize(app.source.detectedProvider))
        : null,
      "fallback",
    );
    addItem(
      "build",
      app.source.buildStrategy,
      app.source.buildStrategy ? humanize(app.source.buildStrategy) : null,
      "fallback",
    );
    for (const service of app.backingServices) {
      addItem(
        "service",
        service.type,
        service.type ? humanize(service.type) : null,
        "fallback",
      );
    }
  }

  const techOrder = new Map<string, number>([
    ["stack", 0],
    ["language", 0],
    ["service", 1],
    ["build", 2],
  ]);
  const primary = items.filter(
    (item) =>
      item.kind === "stack" ||
      item.kind === "language" ||
      item.kind === "service",
  );
  const visible = (primary.length ? primary : items).filter(
    (item) => item.kind !== "source",
  );

  return [...visible]
    .sort((left, right) => {
      const leftOrder = techOrder.get(left.kind) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = techOrder.get(right.kind) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, 4);
}

function toneForStatus(status?: string | null): ConsoleTone {
  const normalized = status?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("ready") ||
    normalized.includes("active") ||
    normalized.includes("running")
  ) {
    return "positive";
  }

  if (
    normalized.includes("deploy") ||
    normalized.includes("build") ||
    normalized.includes("pending")
  ) {
    return "info";
  }

  if (normalized.includes("disable") || normalized.includes("blocked")) {
    return "warning";
  }

  if (
    normalized.includes("delete") ||
    normalized.includes("fail") ||
    normalized.includes("error")
  ) {
    return "danger";
  }

  return "neutral";
}

function readRouteInfo(app: FugueApp) {
  const publicUrl = app.route.publicUrl?.trim();

  if (publicUrl) {
    try {
      return {
        href: publicUrl,
        label: new URL(publicUrl).host,
      };
    } catch {
      return {
        href: null,
        label: publicUrl,
      };
    }
  }

  if (app.route.hostname) {
    return {
      href: null,
      label: app.route.hostname,
    };
  }

  return {
    href: null,
    label: "Unassigned",
  };
}

function mapAdminApps(
  apps: FugueApp[],
  projects: FugueProject[],
  workspaces: WorkspaceSnapshot[],
  tenants: FugueTenant[],
  appImageUsage: AdminAppImageUsageLookup,
  runtimes: FugueRuntime[],
) {
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name] as const),
  );
  const workspaceEmailsByTenant = new Map(
    workspaces.map(
      (workspace) => [workspace.tenantId, workspace.email] as const,
    ),
  );
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );
  const serverNamesByRuntime = new Map<string, string>();

  for (const runtime of runtimes) {
    const runtimeId = runtime.id?.trim();
    const serverName =
      runtime.clusterNodeName?.trim() || runtime.machineName?.trim();

    if (!runtimeId || !serverName || serverNamesByRuntime.has(runtimeId)) {
      continue;
    }

    serverNamesByRuntime.set(runtimeId, serverName);
  }

  return [...apps]
    .sort(
      (left, right) =>
        parseTimestamp(
          right.status.updatedAt ?? right.updatedAt ?? right.createdAt,
        ) -
        parseTimestamp(
          left.status.updatedAt ?? left.updatedAt ?? left.createdAt,
        ),
    )
    .map((app) => {
      const createdAt = app.createdAt;
      const route = readRouteInfo(app);
      const phase =
        app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown");
      const runtimeId = app.status.currentRuntimeId ?? app.spec.runtimeId;

      return {
        canRebuild: canRebuildApp(app),
        createdExact: formatExactTime(createdAt),
        createdLabel: formatRelativeTime(createdAt),
        id: app.id,
        name: app.name,
        ownerLabel: app.tenantId
          ? (workspaceEmailsByTenant.get(app.tenantId) ??
            tenantNames.get(app.tenantId) ??
            shortId(app.tenantId))
          : "Unknown",
        phase: humanize(phase),
        phaseTone: toneForStatus(phase),
        projectLabel: app.projectId
          ? (projectNames.get(app.projectId) ?? shortId(app.projectId))
          : "Unassigned",
        resourceUsage: buildAdminAppResourceUsage(app, appImageUsage),
        routeHref: route.href,
        routeLabel: route.label,
        serverLabel: runtimeId
          ? (serverNamesByRuntime.get(runtimeId) ?? shortId(runtimeId))
          : "Unassigned",
        sourceHref: readFugueSourceHref(app.source),
        sourceLabel: readFugueSourceLabel(app.source),
        stack: buildAppStack(app),
      } satisfies AdminClusterAppView;
    });
}

function applyAdminAppsUsageData(
  apps: AdminClusterAppView[],
  usageData: AdminAppsUsageData | null,
) {
  if (!usageData?.apps.length) {
    return apps;
  }

  const usageByAppId = new Map(
    usageData.apps.map((app) => [app.id, app.resourceUsage] as const),
  );

  return apps.map((app) => {
    const resourceUsage = usageByAppId.get(app.id);

    return resourceUsage
      ? {
          ...app,
          resourceUsage,
        }
      : app;
  });
}

async function getClusterProjects(
  bootstrapKey: string,
  tenants: FugueTenant[],
) {
  try {
    return {
      errors: [],
      projects: await getFugueProjects(bootstrapKey),
    } satisfies {
      errors: string[];
      projects: FugueProject[];
    };
  } catch {
    // Fall back to tenant-scoped listing when the backend does not yet expose
    // the platform-wide fast path.
  }

  if (!tenants.length) {
    return {
      errors: [],
      projects: [],
    } satisfies {
      errors: string[];
      projects: FugueProject[];
    };
  }

  const projectResults = await Promise.allSettled(
    tenants.map((tenant) => getFugueProjects(bootstrapKey, tenant.id)),
  );
  const projects: FugueProject[] = [];
  const errors: string[] = [];

  for (const [index, result] of projectResults.entries()) {
    const tenant = tenants[index];

    if (result.status === "fulfilled") {
      projects.push(...result.value);
      continue;
    }

    errors.push(
      `projects (${tenant?.name ?? tenant?.id ?? "unknown tenant"}): ${readErrorMessage(result.reason)}`,
    );
  }

  return {
    errors,
    projects,
  };
}

function buildUserViews(
  users: AppUserRecord[],
  workspaces: WorkspaceSnapshot[],
  enrichment: AdminUsersEnrichmentLookup,
) {
  let bootstrapAdminEmail: string | null = null;
  let bootstrapAdminCreatedAt = Number.POSITIVE_INFINITY;

  for (const user of users) {
    if (user.status === "deleted") {
      continue;
    }

    const createdAt = parseTimestamp(user.createdAt);

    if (
      createdAt < bootstrapAdminCreatedAt ||
      (createdAt === bootstrapAdminCreatedAt &&
        user.email.localeCompare(bootstrapAdminEmail ?? user.email) < 0)
    ) {
      bootstrapAdminEmail = user.email;
      bootstrapAdminCreatedAt = createdAt;
    }
  }

  const workspaceByEmail = new Map(
    workspaces.map((workspace) => [workspace.email, workspace] as const),
  );
  const tenantServiceUsageByTenant = enrichment.loaded
    ? buildAdminTenantServiceUsageLookup(
        enrichment.apps,
        enrichment.appImageUsage,
      )
    : new Map<string, AdminTenantServiceUsageSummary>();

  return users.map((user) => {
    const workspace = workspaceByEmail.get(user.email);
    const billing =
      enrichment.loaded && workspace?.tenantId
        ? enrichment.billingByTenant.get(workspace.tenantId)
        : undefined;
    const tenantServiceUsage = workspace?.tenantId
      ? tenantServiceUsageByTenant.get(workspace.tenantId)
      : undefined;
    const serviceCount =
      enrichment.loaded && tenantServiceUsage
        ? tenantServiceUsage.serviceCount
        : 0;
    const hasWorkspace = Boolean(workspace?.tenantId);

    return {
      billing: buildAdminUserBillingView(workspace, billing, enrichment.loaded),
      canBlock: !user.isAdmin && user.status === "active",
      canDemoteAdmin:
        user.isAdmin &&
        user.status !== "deleted" &&
        user.email !== bootstrapAdminEmail,
      canDelete: !user.isAdmin && user.status !== "deleted",
      canPromoteToAdmin: !user.isAdmin && user.status !== "deleted",
      canUnblock: !user.isAdmin && user.status === "blocked",
      email: user.email,
      isAdmin: user.isAdmin,
      lastLoginExact: formatExactTime(user.lastLoginAt),
      lastLoginLabel: formatRelativeTime(user.lastLoginAt),
      name: user.name ?? user.email.split("@")[0] ?? user.email,
      provider: readProviderLabel(user.provider) ?? humanize(user.provider),
      serviceCount,
      status: humanize(user.status),
      statusTone: toneForStatus(user.status),
      usage: buildAdminUserServiceUsageView(
        tenantServiceUsage,
        enrichment.appImageUsage.loaded,
        hasWorkspace && !enrichment.loaded,
      ),
      verified: user.verified,
      workspace: buildAdminUserWorkspaceView(workspace),
    } satisfies AdminUserView;
  });
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function hasFreshAdminUsersEnrichmentData() {
  return (
    cachedAdminUsersEnrichmentData !== null &&
    Date.now() - cachedAdminUsersEnrichmentAt <
      ADMIN_USERS_ENRICHMENT_CACHE_TTL_MS
  );
}

function createPendingAdminUsersEnrichmentLookup(): AdminUsersEnrichmentLookup {
  return {
    appImageUsage: createAdminAppImageUsageLookup(null),
    apps: [],
    billingByTenant: new Map<string, AdminTenantBillingLookup>(),
    loaded: false,
  };
}

function buildAdminUsersSummary(
  users: AdminUserView[],
): AdminUsersPageData["summary"] {
  return {
    adminCount: users.filter((user) => user.isAdmin).length,
    blockedCount: users.filter(
      (user) => user.status.trim().toLowerCase() === "blocked",
    ).length,
    deletedCount: users.filter(
      (user) => user.status.trim().toLowerCase() === "deleted",
    ).length,
    userCount: users.length,
  };
}

function applyAdminUsersUsageData(
  data: AdminUsersPageData,
  usageData: AdminUsersUsageData | null,
) {
  if (!usageData?.users.length) {
    return data;
  }

  const usageByEmail = new Map(
    usageData.users.map((user) => [user.email, user] as const),
  );
  const users = data.users.map((user) => {
    const usage = usageByEmail.get(user.email);

    return usage
      ? {
          ...user,
          serviceCount: usage.serviceCount,
          usage: usage.usage,
        }
      : user;
  });

  return {
    ...data,
    summary: buildAdminUsersSummary(users),
    users,
  };
}

function buildAdminUsersPageData(
  base: AdminUsersBaseData,
  enrichment: AdminUsersEnrichmentLookup,
  errors: string[],
  enrichmentState: AdminUsersPageData["enrichmentState"],
): AdminUsersPageData {
  const users = buildUserViews(base.users, base.workspaces, enrichment);

  return {
    enrichmentState,
    errors,
    summary: buildAdminUsersSummary(users),
    users,
  };
}

async function loadAdminUsersBaseData(options?: {
  includeWorkspaces?: boolean;
}): Promise<AdminUsersBaseData> {
  const includeWorkspaces = options?.includeWorkspaces ?? false;
  const [usersResult, workspacesResult] = await Promise.allSettled([
    listAppUsers(),
    includeWorkspaces ? listWorkspaceSnapshots() : Promise.resolve([]),
  ]);

  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  const workspaces =
    workspacesResult.status === "fulfilled" ? workspacesResult.value : [];
  const errors = [
    usersResult.status === "rejected"
      ? `users: ${readErrorMessage(usersResult.reason)}`
      : null,
    workspacesResult.status === "rejected"
      ? `workspaces: ${readErrorMessage(workspacesResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    errors,
    users,
    workspaces,
  };
}

type AdminTenantBillingLookup = {
  billing: FugueBillingSummary | null;
  error: string | null;
};

function formatCompactNumber(value: number, digits = 1) {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });

  return formatter.format(value);
}

function formatCurrencyFromMicroCents(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value / MICRO_CENTS_PER_DOLLAR);
}

function formatBillingCPU(cpuMillicores: number) {
  const cores = cpuMillicores / 1000;

  if (cpuMillicores === 0) {
    return "0 cpu";
  }

  const digits = Number.isInteger(cores) ? 0 : cores >= 10 ? 1 : 2;
  return `${formatCompactNumber(cores, digits)} cpu`;
}

function formatBillingMemory(memoryMebibytes: number) {
  const gib = memoryMebibytes / 1024;
  return `${formatCompactNumber(gib, Number.isInteger(gib) ? 0 : 2)} GiB`;
}

function formatBillingStorage(storageGibibytes: number) {
  return `${formatCompactNumber(storageGibibytes, Number.isInteger(storageGibibytes) ? 0 : 2)} GiB`;
}

function formatBillingResourceSpec(spec: FugueResourceSpec) {
  const parts = [
    formatBillingCPU(spec.cpuMillicores),
    formatBillingMemory(spec.memoryMebibytes),
  ];

  if (spec.storageGibibytes !== undefined) {
    parts.push(formatBillingStorage(spec.storageGibibytes));
  }

  return parts.join(" / ");
}

function readBillingStatusTone(billing: FugueBillingSummary): ConsoleTone {
  if (billing.overCap || billing.status === "over-cap") {
    return "warning";
  }

  if (billing.balanceRestricted || billing.status === "restricted") {
    return "warning";
  }

  if (billing.status === "active") {
    return "positive";
  }

  return "neutral";
}

function buildAdminUserBillingView(
  workspace: WorkspaceSnapshot | undefined,
  billingLookup: AdminTenantBillingLookup | undefined,
  loaded: boolean,
): AdminUserBillingView {
  if (!workspace?.tenantId) {
    return {
      balanceLabel: null,
      balanceMicroCents: null,
      committedStorageGibibytes: null,
      cpuMillicores: null,
      limitLabel: "No workspace",
      loadError: null,
      loading: false,
      memoryMebibytes: null,
      monthlyEstimateLabel: null,
      priceBook: null,
      storageGibibytes: null,
      statusLabel: null,
      statusReason: null,
      statusTone: "neutral",
      tenantId: null,
    };
  }

  if (!loaded) {
    return {
      balanceLabel: null,
      balanceMicroCents: null,
      committedStorageGibibytes: null,
      cpuMillicores: null,
      limitLabel: "Loading billing…",
      loadError: null,
      loading: true,
      memoryMebibytes: null,
      monthlyEstimateLabel: null,
      priceBook: null,
      storageGibibytes: null,
      statusLabel: null,
      statusReason: null,
      statusTone: "neutral",
      tenantId: workspace.tenantId,
    };
  }

  if (!billingLookup?.billing) {
    return {
      balanceLabel: null,
      balanceMicroCents: null,
      committedStorageGibibytes: null,
      cpuMillicores: null,
      limitLabel: "Billing unavailable",
      loadError:
        billingLookup?.error ??
        "Fugue billing is unavailable for this workspace.",
      loading: false,
      memoryMebibytes: null,
      monthlyEstimateLabel: null,
      priceBook: null,
      storageGibibytes: null,
      statusLabel: null,
      statusReason: null,
      statusTone: "neutral",
      tenantId: workspace.tenantId,
    };
  }

  const billing = billingLookup.billing;

  return {
    balanceLabel: formatCurrencyFromMicroCents(
      billing.balanceMicroCents,
      billing.priceBook.currency,
    ),
    balanceMicroCents: billing.balanceMicroCents,
    committedStorageGibibytes: billing.managedCommitted.storageGibibytes,
    cpuMillicores: billing.managedCap.cpuMillicores,
    limitLabel: formatBillingResourceSpec(billing.managedCap),
    loadError: null,
    loading: false,
    memoryMebibytes: billing.managedCap.memoryMebibytes,
    monthlyEstimateLabel: formatCurrencyFromMicroCents(
      billing.monthlyEstimateMicroCents,
      billing.priceBook.currency,
    ),
    priceBook: billing.priceBook,
    storageGibibytes: billing.managedCap.storageGibibytes,
    statusLabel: humanize(billing.status),
    statusReason: billing.statusReason,
    statusTone: readBillingStatusTone(billing),
    tenantId: billing.tenantId,
  };
}

function buildAdminUserWorkspaceView(
  workspace: WorkspaceSnapshot | undefined,
): AdminUserWorkspaceView | null {
  if (!workspace) {
    return null;
  }
  return {
    adminKeyLabel: workspace.adminKeyLabel ?? null,
    defaultProjectId: workspace.defaultProjectId ?? null,
    defaultProjectName: workspace.defaultProjectName ?? null,
    firstAppId: workspace.firstAppId ?? null,
    tenantId: workspace.tenantId ?? null,
    tenantName: workspace.tenantName ?? null,
  };
}

function formatPercentLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "No stats";
  }

  return `${formatCompactNumber(value, 1)}%`;
}

function formatBytesLabel(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
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

function formatCPUCapacityLabel(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return "No stats";
  }

  if (Math.abs(value) >= 1000) {
    const cores = value / 1000;
    return `${formatCompactNumber(cores, 1)} ${cores === 1 ? "core" : "cores"}`;
  }

  return `${Math.round(value)} millicores`;
}

type AdminAppImageUsageLookup = {
  byAppId: Map<string, FugueProjectImageUsageAppSummary>;
  loaded: boolean;
};

function createAdminAppImageUsageLookup(
  result?: FugueProjectImageUsageResult | null,
): AdminAppImageUsageLookup {
  if (!result) {
    return {
      byAppId: new Map<string, FugueProjectImageUsageAppSummary>(),
      loaded: false,
    };
  }

  const byAppId = new Map<string, FugueProjectImageUsageAppSummary>();

  for (const project of result.projects ?? []) {
    for (const app of project.apps ?? []) {
      byAppId.set(app.appId, app);
    }
  }

  return {
    byAppId,
    loaded: true,
  };
}

function formatAdminImageUsageLabel(
  imageUsage: FugueProjectImageUsageAppSummary | null | undefined,
  loaded: boolean,
) {
  if (!loaded) {
    return "No stats";
  }

  if (
    !imageUsage ||
    imageUsage.versionCount <= 0 ||
    imageUsage.totalSizeBytes <= 0
  ) {
    return "No images";
  }

  return formatBytesLabel(imageUsage.totalSizeBytes);
}

function buildAdminImageUsageSecondaryLabel(
  imageUsage: FugueProjectImageUsageAppSummary | null | undefined,
  loaded: boolean,
) {
  if (
    !loaded ||
    !imageUsage ||
    imageUsage.versionCount <= 0 ||
    imageUsage.totalSizeBytes <= 0
  ) {
    return null;
  }

  return formatCountLabel(imageUsage.versionCount, "version");
}

type AdminTenantServiceUsageSummary = {
  appIds: Set<string>;
  backingServiceIds: Set<string>;
  cpuMillicores: number | null;
  ephemeralStorageBytes: number | null;
  imageBytes: number | null;
  memoryBytes: number | null;
  serviceCount: number;
};

function createAdminTenantServiceUsageSummary(
  imageUsageLoaded: boolean,
): AdminTenantServiceUsageSummary {
  return {
    appIds: new Set<string>(),
    backingServiceIds: new Set<string>(),
    cpuMillicores: null,
    ephemeralStorageBytes: null,
    imageBytes: imageUsageLoaded ? 0 : null,
    memoryBytes: null,
    serviceCount: 0,
  };
}

function appendResourceUsage(
  summary: Pick<
    AdminTenantServiceUsageSummary,
    "cpuMillicores" | "ephemeralStorageBytes" | "memoryBytes"
  >,
  usage: FugueApp["currentResourceUsage"],
) {
  if (usage?.cpuMillicores !== null && usage?.cpuMillicores !== undefined) {
    summary.cpuMillicores = (summary.cpuMillicores ?? 0) + usage.cpuMillicores;
  }

  if (usage?.memoryBytes !== null && usage?.memoryBytes !== undefined) {
    summary.memoryBytes = (summary.memoryBytes ?? 0) + usage.memoryBytes;
  }

  if (
    usage?.ephemeralStorageBytes !== null &&
    usage?.ephemeralStorageBytes !== undefined
  ) {
    summary.ephemeralStorageBytes =
      (summary.ephemeralStorageBytes ?? 0) + usage.ephemeralStorageBytes;
  }
}

function buildAdminTenantServiceUsageLookup(
  apps: FugueApp[],
  appImageUsage: AdminAppImageUsageLookup,
) {
  const byTenant = new Map<string, AdminTenantServiceUsageSummary>();

  for (const app of apps) {
    if (!app.tenantId) {
      continue;
    }

    const summary =
      byTenant.get(app.tenantId) ??
      createAdminTenantServiceUsageSummary(appImageUsage.loaded);

    if (!byTenant.has(app.tenantId)) {
      byTenant.set(app.tenantId, summary);
    }

    if (!summary.appIds.has(app.id)) {
      summary.appIds.add(app.id);
      summary.serviceCount += 1;
      appendResourceUsage(summary, app.currentResourceUsage);
      if (appImageUsage.loaded) {
        summary.imageBytes =
          (summary.imageBytes ?? 0) +
          (appImageUsage.byAppId.get(app.id)?.totalSizeBytes ?? 0);
      }
    }

    for (const service of app.backingServices) {
      if (summary.backingServiceIds.has(service.id)) {
        continue;
      }

      summary.backingServiceIds.add(service.id);
      summary.serviceCount += 1;
      appendResourceUsage(summary, service.currentResourceUsage);
    }
  }

  return byTenant;
}

function buildAdminUserServiceUsageView(
  summary: AdminTenantServiceUsageSummary | undefined,
  imageUsageLoaded: boolean,
  loading: boolean,
): AdminUserServiceUsageView {
  if (loading) {
    return {
      cpuLabel: "Loading…",
      diskLabel: "Loading…",
      imageLabel: "Loading…",
      loading: true,
      memoryLabel: "Loading…",
      serviceCount: 0,
      serviceCountLabel: "Loading…",
    };
  }

  const serviceCount = summary?.serviceCount ?? 0;

  return {
    cpuLabel: formatCPUCapacityLabel(summary?.cpuMillicores),
    diskLabel: formatBytesLabel(summary?.ephemeralStorageBytes),
    imageLabel: imageUsageLoaded
      ? summary?.imageBytes && summary.imageBytes > 0
        ? formatBytesLabel(summary.imageBytes)
        : "No images"
      : "No stats",
    loading: false,
    memoryLabel: formatBytesLabel(summary?.memoryBytes),
    serviceCount,
    serviceCountLabel: formatCountLabel(serviceCount, "service"),
  };
}

function buildResourceTitle(
  label: string,
  primaryLabel: string,
  secondaryLabel?: string | null,
) {
  return secondaryLabel
    ? `${label} / ${primaryLabel} / ${secondaryLabel}`
    : `${label} / ${primaryLabel}`;
}

function buildAdminAppResourceUsage(
  app: FugueApp,
  appImageUsage: AdminAppImageUsageLookup,
): ConsoleCompactResourceItemView[] {
  const usage = app.currentResourceUsage;
  const imageUsage = appImageUsage.byAppId.get(app.id);
  const cpuPrimaryLabel = formatCPUCapacityLabel(usage?.cpuMillicores);
  const memoryPrimaryLabel = formatBytesLabel(usage?.memoryBytes);
  const diskPrimaryLabel = formatBytesLabel(usage?.ephemeralStorageBytes);
  const imagePrimaryLabel = formatAdminImageUsageLabel(
    imageUsage,
    appImageUsage.loaded,
  );
  const imageSecondaryLabel = buildAdminImageUsageSecondaryLabel(
    imageUsage,
    appImageUsage.loaded,
  );
  const hasCpuUsage =
    usage?.cpuMillicores !== null && usage?.cpuMillicores !== undefined;
  const hasMemoryUsage =
    usage?.memoryBytes !== null && usage?.memoryBytes !== undefined;
  const hasDiskUsage =
    usage?.ephemeralStorageBytes !== null &&
    usage?.ephemeralStorageBytes !== undefined;
  const hasImageUsage =
    appImageUsage.loaded &&
    Boolean(
      imageUsage &&
      imageUsage.versionCount > 0 &&
      imageUsage.totalSizeBytes > 0,
    );

  return [
    {
      id: "cpu",
      label: "CPU",
      meterValue: null,
      primaryLabel: cpuPrimaryLabel,
      secondaryLabel: null,
      title: buildResourceTitle(
        "CPU",
        cpuPrimaryLabel,
        hasCpuUsage ? "Current live sample" : null,
      ),
      tone: hasCpuUsage ? "info" : "neutral",
    },
    {
      id: "memory",
      label: "Memory",
      meterValue: null,
      primaryLabel: memoryPrimaryLabel,
      secondaryLabel: null,
      title: buildResourceTitle(
        "Memory",
        memoryPrimaryLabel,
        hasMemoryUsage ? "Current live sample" : null,
      ),
      tone: hasMemoryUsage ? "info" : "neutral",
    },
    {
      id: "storage",
      label: "Disk",
      meterValue: null,
      primaryLabel: diskPrimaryLabel,
      secondaryLabel: null,
      title: buildResourceTitle(
        "Disk",
        diskPrimaryLabel,
        hasDiskUsage ? "Current live sample" : null,
      ),
      tone: hasDiskUsage ? "info" : "neutral",
    },
    {
      id: "images",
      label: "Images",
      meterValue: null,
      primaryLabel: imagePrimaryLabel,
      secondaryLabel: imageSecondaryLabel,
      title: buildResourceTitle(
        "Images",
        imagePrimaryLabel,
        appImageUsage.loaded
          ? (imageSecondaryLabel ?? "Stored app images")
          : null,
      ),
      tone: hasImageUsage ? "info" : "neutral",
    },
  ];
}

function toneWeight(tone: ConsoleTone) {
  switch (tone) {
    case "danger":
      return 4;
    case "warning":
      return 3;
    case "info":
      return 2;
    case "positive":
      return 1;
    default:
      return 0;
  }
}

function readResourceTone(
  percent?: number | null,
  dangerSignal = false,
): ConsoleTone {
  if (dangerSignal) {
    return "danger";
  }

  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return "neutral";
  }

  if (percent >= 90) {
    return "danger";
  }

  if (percent >= 70) {
    return "warning";
  }

  if (percent >= 40) {
    return "info";
  }

  return "positive";
}

function readResourceStatusLabel(
  percent?: number | null,
  dangerSignal = false,
) {
  if (dangerSignal) {
    return "Pressure";
  }

  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return "No stats";
  }

  if (percent >= 90) {
    return "Hot";
  }

  if (percent >= 70) {
    return "Watch";
  }

  if (percent >= 40) {
    return "Steady";
  }

  return "Headroom";
}

function readConditionTone(
  conditionID: string,
  status?: string | null,
): ConsoleTone {
  const normalized = status?.trim().toLowerCase() ?? "";

  if (conditionID === CLUSTER_READY_CONDITION) {
    if (normalized === "true") {
      return "positive";
    }

    if (normalized === "false") {
      return "danger";
    }

    return "neutral";
  }

  if (normalized === "true") {
    return "danger";
  }

  if (normalized === "false") {
    return "positive";
  }

  return "neutral";
}

function readConditionStatusLabel(conditionID: string, status?: string | null) {
  const normalized = status?.trim().toLowerCase() ?? "";

  if (conditionID === CLUSTER_READY_CONDITION) {
    if (normalized === "true") {
      return "Ready";
    }

    if (normalized === "false") {
      return "Not ready";
    }

    return "Unknown";
  }

  if (normalized === "true") {
    return "Pressure";
  }

  if (normalized === "false") {
    return "Clear";
  }

  return "Unknown";
}

function isConditionActive(status?: string | null) {
  return status?.trim().toLowerCase() === "true";
}

function buildCPUResourceView(
  stats: FugueClusterNodeCPUStats | null,
): AdminClusterResourceView {
  const percent = stats?.usagePercent ?? null;
  const total =
    stats?.allocatableMilliCores ?? stats?.capacityMilliCores ?? null;

  return {
    detailLabel:
      stats?.capacityMilliCores !== null &&
      stats?.capacityMilliCores !== undefined
        ? `${formatCPUCapacityLabel(stats.capacityMilliCores)} capacity`
        : "Capacity unknown",
    id: "cpu",
    label: "Compute",
    percentLabel: formatPercentLabel(percent),
    percentValue: percent,
    statusLabel: readResourceStatusLabel(percent),
    statusTone: readResourceTone(percent),
    totalLabel:
      total !== null && total !== undefined
        ? `${formatCPUCapacityLabel(total)} allocatable`
        : "Allocatable unknown",
    usageLabel: formatCPUCapacityLabel(stats?.usedMilliCores),
  };
}

function buildMemoryResourceView(
  stats: FugueClusterNodeMemoryStats | null,
  hasPressure: boolean,
): AdminClusterResourceView {
  const percent = stats?.usagePercent ?? null;
  const total = stats?.allocatableBytes ?? stats?.capacityBytes ?? null;

  return {
    detailLabel:
      stats?.capacityBytes !== null && stats?.capacityBytes !== undefined
        ? `${formatBytesLabel(stats.capacityBytes)} capacity`
        : "Capacity unknown",
    id: "memory",
    label: "Memory",
    percentLabel: formatPercentLabel(percent),
    percentValue: percent,
    statusLabel: readResourceStatusLabel(percent, hasPressure),
    statusTone: readResourceTone(percent, hasPressure),
    totalLabel:
      total !== null && total !== undefined
        ? `${formatBytesLabel(total)} allocatable`
        : "Allocatable unknown",
    usageLabel: formatBytesLabel(stats?.usedBytes),
  };
}

function buildStorageResourceView(
  stats: FugueClusterNodeStorageStats | null,
  hasPressure: boolean,
): AdminClusterResourceView {
  const percent = stats?.usagePercent ?? null;
  const total = stats?.allocatableBytes ?? stats?.capacityBytes ?? null;

  return {
    detailLabel:
      stats?.capacityBytes !== null && stats?.capacityBytes !== undefined
        ? `${formatBytesLabel(stats.capacityBytes)} capacity`
        : "Capacity unknown",
    id: "storage",
    label: "Disk",
    percentLabel: formatPercentLabel(percent),
    percentValue: percent,
    statusLabel: readResourceStatusLabel(percent, hasPressure),
    statusTone: readResourceTone(percent, hasPressure),
    totalLabel:
      total !== null && total !== undefined
        ? `${formatBytesLabel(total)} allocatable`
        : "Allocatable unknown",
    usageLabel: formatBytesLabel(stats?.usedBytes),
  };
}

function buildClusterConditionViews(
  node: FugueClusterNode,
): AdminClusterConditionView[] {
  const definitions = [
    { id: CLUSTER_READY_CONDITION, label: "Ready" },
    { id: CLUSTER_MEMORY_PRESSURE_CONDITION, label: "Memory" },
    { id: CLUSTER_DISK_PRESSURE_CONDITION, label: "Disk" },
    { id: CLUSTER_PID_PRESSURE_CONDITION, label: "Process" },
  ] as const;

  return definitions.map((definition) => {
    const condition = node.conditions[definition.id];
    const transitionedAt = condition?.lastTransitionAt ?? null;
    const detail = condition?.message?.trim() || condition?.reason?.trim();

    return {
      detailLabel:
        detail ||
        (transitionedAt
          ? `Updated ${formatRelativeTime(transitionedAt)}`
          : "No signal reported"),
      id: definition.id,
      label: definition.label,
      lastTransitionExact: formatExactTime(transitionedAt),
      lastTransitionLabel: formatRelativeTime(transitionedAt),
      statusLabel: readConditionStatusLabel(definition.id, condition?.status),
      tone: readConditionTone(definition.id, condition?.status),
    } satisfies AdminClusterConditionView;
  });
}

function joinConditionLabels(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function readClusterNodeMachineScopeLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "platform-node":
      return "Platform node";
    case "tenant-runtime":
      return "Tenant runtime";
    default:
      return "Unmanaged";
  }
}

function readClusterNodeConnectionModeLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "cluster":
      return "Cluster join";
    case "agent":
      return "Agent";
    default:
      return "Unknown";
  }
}

function readClusterNodeControlPlaneRoleLabel(value?: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "member":
      return "Member";
    case "candidate":
      return "Candidate";
    case "none":
      return "Off";
    default:
      return "Unknown";
  }
}

function buildAdminClusterNodeMachineView(
  node: FugueClusterNode,
): AdminClusterNodeMachineView | null {
  if (!node.machine) {
    return null;
  }

  return {
    connectionMode: node.machine.connectionMode,
    connectionModeLabel: readClusterNodeConnectionModeLabel(
      node.machine.connectionMode,
    ),
    id: node.machine.id?.trim() || null,
    nodeKeyId: node.machine.nodeKeyId?.trim() || null,
    nodeKeyLabel: node.machine.nodeKeyId
      ? shortId(node.machine.nodeKeyId)
      : "Unassigned",
    scope: node.machine.scope,
    scopeLabel: readClusterNodeMachineScopeLabel(node.machine.scope),
    status: node.machine.status,
    statusLabel: humanize(node.machine.status) || "Unknown",
  };
}

function buildAdminClusterNodePolicyView(
  node: FugueClusterNode,
): AdminClusterNodePolicyView | null {
  if (!node.policy) {
    return null;
  }

  return {
    allowBuilds: node.policy.allowBuilds ?? false,
    allowSharedPool: node.policy.allowSharedPool ?? false,
    desiredControlPlaneRole: node.policy.desiredControlPlaneRole,
    desiredControlPlaneRoleLabel: readClusterNodeControlPlaneRoleLabel(
      node.policy.desiredControlPlaneRole,
    ),
    effectiveBuilds: node.policy.effectiveBuilds ?? false,
    effectiveControlPlaneRole: node.policy.effectiveControlPlaneRole,
    effectiveControlPlaneRoleLabel: readClusterNodeControlPlaneRoleLabel(
      node.policy.effectiveControlPlaneRole,
    ),
    effectiveSharedPool: node.policy.effectiveSharedPool ?? false,
  };
}

function buildClusterWorkloadViews(
  workloads: FugueClusterNodeWorkload[],
  tenantNames: Map<string, string>,
) {
  return workloads.map((workload) => {
    const tenantLabel = workload.tenantId
      ? (tenantNames.get(workload.tenantId) ?? shortId(workload.tenantId))
      : "Shared";
    const podCount = workload.podCount || workload.pods.length;
    const kindLabel =
      workload.kind === "backing_service"
        ? workload.serviceType
          ? humanize(workload.serviceType)
          : "Service"
        : "App";
    const metaParts = [
      formatCountLabel(podCount, "pod"),
      tenantLabel,
      workload.namespace?.trim() || null,
    ].filter((value): value is string => Boolean(value));
    const podLabel = workload.pods.length
      ? workload.pods
          .map((pod) =>
            pod.phase?.trim()
              ? `${pod.name} (${humanize(pod.phase)})`
              : pod.name,
          )
          .join(" / ")
      : "No active pods reported";

    return {
      id: workload.id,
      kindLabel,
      kindTone: workload.kind === "backing_service" ? "neutral" : "info",
      metaLabel: metaParts.join(" / "),
      name: workload.name,
      title: `${workload.name} / ${kindLabel} / ${metaParts.join(" / ")} / ${podLabel}`,
    } satisfies AdminClusterWorkloadView;
  });
}

function buildClusterNodeViewItem(
  node: FugueClusterNode,
  tenantNames: Map<string, string>,
) {
  const conditionViews = buildClusterConditionViews(node);
  const memoryPressure = isConditionActive(
    node.conditions[CLUSTER_MEMORY_PRESSURE_CONDITION]?.status,
  );
  const diskPressure = isConditionActive(
    node.conditions[CLUSTER_DISK_PRESSURE_CONDITION]?.status,
  );
  const pressureSignals = conditionViews.filter(
    (condition) =>
      condition.id !== CLUSTER_READY_CONDITION &&
      condition.statusLabel === "Pressure",
  );
  const workloadCount = node.workloads.length;
  const appCount = node.workloads.filter(
    (workload) => workload.kind === "app",
  ).length;
  const serviceCount = node.workloads.filter(
    (workload) => workload.kind === "backing_service",
  ).length;
  const statusLabel =
    node.status?.trim().toLowerCase() === "not-ready"
      ? "Not ready"
      : pressureSignals.length
        ? "Pressure"
        : node.status?.trim().toLowerCase() === "ready"
          ? "Ready"
          : humanize(node.status);
  const statusTone =
    node.status?.trim().toLowerCase() === "not-ready"
      ? "danger"
      : pressureSignals.length
        ? "warning"
        : node.status?.trim().toLowerCase() === "ready"
          ? "positive"
          : toneForStatus(node.status);
  const location = readCountryLocation(node.region, node.zone);
  const locationLabel = location.locationLabel;
  const statusFragments = [
    locationLabel !== "Unassigned" ? locationLabel : null,
    pressureSignals.length
      ? `${pressureSignals.map((condition) => condition.label.toLowerCase()).join(" + ")} signal${
          pressureSignals.length === 1 ? "" : "s"
        }`
      : null,
    formatCountLabel(workloadCount, "workload"),
  ].filter((value): value is string => Boolean(value));

  return {
    appCount,
    canManagePolicy: Boolean(node.machine),
    conditions: conditionViews,
    createdExact: formatExactTime(node.createdAt),
    createdLabel: formatRelativeTime(node.createdAt),
    headerMeta: statusFragments.join(" · "),
    internalIpLabel: node.internalIp?.trim() || "Unavailable",
    locationCountryCode: location.locationCountryCode,
    locationLabel,
    machine: buildAdminClusterNodeMachineView(node),
    name: node.name,
    policy: buildAdminClusterNodePolicyView(node),
    publicIpLabel: node.publicIp?.trim() || "Unavailable",
    roleLabels: node.roles.length ? node.roles : [],
    resources: [
      buildCPUResourceView(node.cpu),
      buildMemoryResourceView(node.memory, memoryPressure),
      buildStorageResourceView(node.ephemeralStorage, diskPressure),
    ],
    runtimeLabel: node.runtimeId ? shortId(node.runtimeId) : "Unassigned",
    serviceCount,
    statusDetail:
      pressureSignals.length > 0
        ? `${joinConditionLabels(
            pressureSignals.map((condition) => condition.label.toLowerCase()),
          )} pressure reported.`
        : node.status?.trim().toLowerCase() === "ready"
          ? null
          : "Waiting for complete node health telemetry.",
    statusLabel,
    statusTone,
    tenantLabel: node.tenantId
      ? (tenantNames.get(node.tenantId) ?? shortId(node.tenantId))
      : node.runtimeId
        ? "Shared"
        : "Unassigned",
    workloadCount,
    workloads: buildClusterWorkloadViews(node.workloads, tenantNames),
    zoneLabel: node.zone?.trim() || "Unassigned",
  } satisfies AdminClusterNodeView;
}

function buildClusterNodeViews(
  nodes: FugueClusterNode[],
  tenants: FugueTenant[],
) {
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  const views = nodes.map((node) =>
    buildClusterNodeViewItem(node, tenantNames),
  );

  return views.sort((left, right) => {
    const leftTone = Math.max(
      toneWeight(left.statusTone),
      ...left.resources.map((resource) => toneWeight(resource.statusTone)),
    );
    const rightTone = Math.max(
      toneWeight(right.statusTone),
      ...right.resources.map((resource) => toneWeight(resource.statusTone)),
    );

    if (leftTone !== rightTone) {
      return rightTone - leftTone;
    }

    if (left.workloadCount !== right.workloadCount) {
      return right.workloadCount - left.workloadCount;
    }

    return left.name.localeCompare(right.name);
  });
}

async function loadAdminAppsPageData(): Promise<AdminAppsPageData> {
  let bootstrapKey: string;

  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch (error) {
    return {
      apps: [],
      errors: [readErrorMessage(error)],
      summary: {
        appCount: 0,
        latestUpdateLabel: "Not yet",
        routedCount: 0,
        tenantCount: 0,
      },
    };
  }

  const [appsResult, workspacesResult, tenantsResult, runtimesResult] =
    await Promise.all([
      settleResult(
        getFugueApps(bootstrapKey, {
          includeLiveStatus: false,
          includeResourceUsage: false,
        }),
      ),
      settleWithSoftTimeout(
        listWorkspaceSnapshots(),
        ADMIN_OPTIONAL_FETCH_TIMEOUT_MS,
      ),
      settleWithSoftTimeout(
        getFugueTenants(bootstrapKey),
        ADMIN_OPTIONAL_FETCH_TIMEOUT_MS,
      ),
      settleWithSoftTimeout(
        getFugueRuntimes(bootstrapKey, {
          syncLocations: false,
        }),
        ADMIN_OPTIONAL_FETCH_TIMEOUT_MS,
      ),
    ]);

  const errors = [
    tenantsResult.status === "rejected"
      ? `tenants: ${readErrorMessage(tenantsResult.reason)}`
      : null,
    appsResult.status === "rejected"
      ? `apps: ${readErrorMessage(appsResult.reason)}`
      : null,
    workspacesResult.status === "rejected"
      ? `workspaces: ${readErrorMessage(workspacesResult.reason)}`
      : null,
    runtimesResult.status === "rejected"
      ? `runtimes: ${readErrorMessage(runtimesResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const tenants =
    tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const workspaces =
    workspacesResult.status === "fulfilled" ? workspacesResult.value : [];
  const runtimes =
    runtimesResult.status === "fulfilled" ? runtimesResult.value : [];
  const appImageUsage = createAdminAppImageUsageLookup(null);
  const usageData =
    adminAppsUsageDataCache.read(ADMIN_APPS_USAGE_DATA_CACHE_KEY) ??
    (await readPersistedAdminAppsUsageData());
  const projectDataResult =
    tenantsResult.status === "fulfilled"
      ? await settleWithSoftTimeout(
          getClusterProjects(bootstrapKey, tenants),
          ADMIN_OPTIONAL_FETCH_TIMEOUT_MS,
        )
      : {
          status: "fulfilled",
          value: {
            errors: [],
            projects: [],
          },
        };
  const projectData =
    projectDataResult.status === "fulfilled"
      ? projectDataResult.value
      : { errors: [], projects: [] };
  const projects = projectData.projects;
  errors.push(...projectData.errors);
  const views = applyAdminAppsUsageData(
    mapAdminApps(
      apps,
      projects,
      workspaces,
      tenants,
      appImageUsage,
      runtimes,
    ),
    usageData,
  );
  const latestUpdateAt = apps.reduce<string | null>((latest, app) => {
    const candidate = app.status.updatedAt ?? app.updatedAt ?? app.createdAt;
    return parseTimestamp(candidate) > parseTimestamp(latest)
      ? candidate
      : latest;
  }, null);

  return {
    apps: views,
    errors,
    summary: {
      appCount: views.length,
      latestUpdateLabel: formatRelativeTime(latestUpdateAt),
      routedCount: views.filter((app) => app.routeLabel !== "Unassigned")
        .length,
      tenantCount: new Set(apps.map((app) => app.tenantId).filter(Boolean))
        .size,
    },
  };
}

async function readPersistedAdminAppsPageData() {
  const entry = await readAdminSnapshotCache<AdminAppsPageData>(
    ADMIN_APPS_PAGE_DATA_CACHE_KEY,
  ).catch(() => null);

  if (!entry || entry.ageMs > ADMIN_USAGE_PERSISTED_STALE_MS) {
    return null;
  }

  adminAppsPageDataCache.set(ADMIN_APPS_PAGE_DATA_CACHE_KEY, entry.payload);
  return entry.payload;
}

export async function refreshAdminAppsPageData(): Promise<AdminAppsPageData> {
  if (adminAppsPageRefreshRequest) {
    return adminAppsPageRefreshRequest;
  }

  const request = loadAdminAppsPageData()
    .then(async (data) => {
      adminAppsPageDataCache.set(ADMIN_APPS_PAGE_DATA_CACHE_KEY, data);
      await writeAdminSnapshotCache(ADMIN_APPS_PAGE_DATA_CACHE_KEY, data).catch(
        () => undefined,
      );
      return data;
    })
    .finally(() => {
      if (adminAppsPageRefreshRequest === request) {
        adminAppsPageRefreshRequest = null;
      }
    });

  adminAppsPageRefreshRequest = request;
  return request;
}

export async function getAdminAppsPageData(): Promise<AdminAppsPageData> {
  const cached = adminAppsPageDataCache.read(ADMIN_APPS_PAGE_DATA_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const persisted = await readPersistedAdminAppsPageData();

  if (persisted) {
    return persisted;
  }

  return refreshAdminAppsPageData();
}

export function invalidateAdminAppsPageData() {
  adminAppsPageRefreshRequest = null;
  adminAppsUsageRefreshRequest = null;
  adminAppsPageDataCache.clear(ADMIN_APPS_PAGE_DATA_CACHE_KEY);
  adminAppsUsageDataCache.clear(ADMIN_APPS_USAGE_DATA_CACHE_KEY);
  adminAppsUsageCache.clear("apps-with-resource-usage");
  adminAppImageUsageCache.clear("project-image-usage");
  void Promise.allSettled([
    deleteAdminSnapshotCache(ADMIN_APPS_PAGE_DATA_CACHE_KEY),
    deleteAdminSnapshotCache(ADMIN_APPS_USAGE_DATA_CACHE_KEY),
  ]);
}

async function getCachedAdminAppsWithResourceUsage(bootstrapKey: string) {
  return adminAppsUsageCache.getOrLoad("apps-with-resource-usage", () =>
    getFugueApps(bootstrapKey, {
      includeLiveStatus: false,
      includeResourceUsage: true,
    }),
  );
}

async function getCachedAdminAppImageUsage(bootstrapKey: string) {
  return adminAppImageUsageCache.getOrLoad("project-image-usage", () =>
    getFugueProjectImageUsage(bootstrapKey),
  );
}

async function loadAdminAppsUsageData(): Promise<AdminAppsUsageData> {
  const bootstrapKey = getFugueEnv().bootstrapKey;
  const [apps, imageUsageResult] = await Promise.all([
    getCachedAdminAppsWithResourceUsage(bootstrapKey),
    getCachedAdminAppImageUsage(bootstrapKey).catch(() => null),
  ]);
  const appImageUsage = createAdminAppImageUsageLookup(imageUsageResult);

  return {
    apps: apps.map((app) => ({
      id: app.id,
      resourceUsage: buildAdminAppResourceUsage(app, appImageUsage),
    })),
  };
}

async function readPersistedAdminAppsUsageData() {
  const entry = await readAdminSnapshotCache<AdminAppsUsageData>(
    ADMIN_APPS_USAGE_DATA_CACHE_KEY,
  ).catch(() => null);

  if (!entry || entry.ageMs > ADMIN_USAGE_PERSISTED_STALE_MS) {
    return null;
  }

  const data = {
    ...entry.payload,
    pending: false,
  } satisfies AdminAppsUsageData;

  adminAppsUsageDataCache.set(ADMIN_APPS_USAGE_DATA_CACHE_KEY, data);
  return data;
}

export async function refreshAdminAppsUsageData(): Promise<AdminAppsUsageData> {
  if (adminAppsUsageRefreshRequest) {
    return adminAppsUsageRefreshRequest;
  }

  const request = loadAdminAppsUsageData()
    .then(async (data) => {
      adminAppsUsageDataCache.set(ADMIN_APPS_USAGE_DATA_CACHE_KEY, data);
      await writeAdminSnapshotCache(ADMIN_APPS_USAGE_DATA_CACHE_KEY, data).catch(
        () => undefined,
      );
      return data;
    })
    .finally(() => {
      if (adminAppsUsageRefreshRequest === request) {
        adminAppsUsageRefreshRequest = null;
      }
    });

  adminAppsUsageRefreshRequest = request;
  return request;
}

export async function getAdminAppsUsageData(): Promise<AdminAppsUsageData> {
  const cached = adminAppsUsageDataCache.read(ADMIN_APPS_USAGE_DATA_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const persisted = await readPersistedAdminAppsUsageData();

  if (persisted) {
    return persisted;
  }

  return refreshAdminAppsUsageData();
}

export async function getAdminAppsUsageDataFast(
  waitMs = 800,
): Promise<AdminAppsUsageData> {
  const cached = adminAppsUsageDataCache.read(ADMIN_APPS_USAGE_DATA_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const persisted = await readPersistedAdminAppsUsageData();

  if (persisted) {
    return persisted;
  }

  const result = await settleWithSoftTimeout(
    refreshAdminAppsUsageData(),
    waitMs,
  );

  if (result.status === "fulfilled") {
    return result.value;
  }

  return {
    apps: [],
    pending: true,
  };
}

async function loadAdminUsersUsageData(): Promise<AdminUsersUsageData> {
  const bootstrapKey = getFugueEnv().bootstrapKey;
  const [base, apps, imageUsageResult] = await Promise.all([
    loadAdminUsersBaseData({
      includeWorkspaces: true,
    }),
    getCachedAdminAppsWithResourceUsage(bootstrapKey),
    getCachedAdminAppImageUsage(bootstrapKey).catch(() => null),
  ]);

  const workspaceByEmail = new Map(
    base.workspaces.map((workspace) => [workspace.email, workspace] as const),
  );
  const appImageUsage = createAdminAppImageUsageLookup(imageUsageResult);
  const tenantServiceUsageByTenant = buildAdminTenantServiceUsageLookup(
    apps,
    appImageUsage,
  );

  return {
    users: base.users.map((user) => {
      const workspace = workspaceByEmail.get(user.email);
      const tenantServiceUsage = workspace?.tenantId
        ? tenantServiceUsageByTenant.get(workspace.tenantId)
        : undefined;
      const serviceCount = tenantServiceUsage?.serviceCount ?? 0;

      return {
        email: user.email,
        serviceCount,
        usage: buildAdminUserServiceUsageView(
          tenantServiceUsage,
          appImageUsage.loaded,
          false,
        ),
      };
    }),
  };
}

async function readPersistedAdminUsersUsageData() {
  const entry = await readAdminSnapshotCache<AdminUsersUsageData>(
    ADMIN_USERS_USAGE_DATA_CACHE_KEY,
  ).catch(() => null);

  if (!entry || entry.ageMs > ADMIN_USAGE_PERSISTED_STALE_MS) {
    return null;
  }

  const data = {
    ...entry.payload,
    pending: false,
  } satisfies AdminUsersUsageData;

  adminUsersUsageDataCache.set(ADMIN_USERS_USAGE_DATA_CACHE_KEY, data);
  return data;
}

export async function refreshAdminUsersUsageData(): Promise<AdminUsersUsageData> {
  if (adminUsersUsageRefreshRequest) {
    return adminUsersUsageRefreshRequest;
  }

  const request = loadAdminUsersUsageData()
    .then(async (data) => {
      adminUsersUsageDataCache.set(ADMIN_USERS_USAGE_DATA_CACHE_KEY, data);
      await writeAdminSnapshotCache(
        ADMIN_USERS_USAGE_DATA_CACHE_KEY,
        data,
      ).catch(() => undefined);
      return data;
    })
    .finally(() => {
      if (adminUsersUsageRefreshRequest === request) {
        adminUsersUsageRefreshRequest = null;
      }
    });

  adminUsersUsageRefreshRequest = request;
  return request;
}

export async function getAdminUsersUsageData(): Promise<AdminUsersUsageData> {
  const cached = adminUsersUsageDataCache.read(ADMIN_USERS_USAGE_DATA_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const persisted = await readPersistedAdminUsersUsageData();

  if (persisted) {
    return persisted;
  }

  return refreshAdminUsersUsageData();
}

export async function getAdminUsersUsageDataFast(
  waitMs = 800,
): Promise<AdminUsersUsageData> {
  const cached = adminUsersUsageDataCache.read(ADMIN_USERS_USAGE_DATA_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const persisted = await readPersistedAdminUsersUsageData();

  if (persisted) {
    return persisted;
  }

  const result = await settleWithSoftTimeout(
    refreshAdminUsersUsageData(),
    waitMs,
  );

  if (result.status === "fulfilled") {
    return result.value;
  }

  return {
    pending: true,
    users: [],
  };
}

async function getAdminUserBillingLookup(
  bootstrapKey: string,
  workspaces: WorkspaceSnapshot[],
) {
  const uniqueWorkspaces = [
    ...new Map(
      workspaces
        .filter((workspace) => workspace.tenantId)
        .map((workspace) => [workspace.tenantId, workspace] as const),
    ).values(),
  ];

  if (!uniqueWorkspaces.length) {
    return {
      byTenant: new Map<string, AdminTenantBillingLookup>(),
      errors: [],
    };
  }

  const billingResults = await Promise.allSettled(
    uniqueWorkspaces.map((workspace) =>
      getFugueBillingSummary(bootstrapKey, workspace.tenantId, {
        includeCurrentUsage: false,
      }),
    ),
  );

  const byTenant = new Map<string, AdminTenantBillingLookup>();
  const errors: string[] = [];

  for (const [index, result] of billingResults.entries()) {
    const workspace = uniqueWorkspaces[index];

    if (!workspace) {
      continue;
    }

    if (result.status === "fulfilled") {
      byTenant.set(workspace.tenantId, {
        billing: result.value,
        error: null,
      });
      continue;
    }

    const message = readErrorMessage(result.reason);
    byTenant.set(workspace.tenantId, {
      billing: null,
      error: message,
    });
    errors.push(
      `billing (${workspace.tenantName || workspace.tenantId}): ${message}`,
    );
  }

  return {
    byTenant,
    errors,
  };
}

async function loadAdminUsersPageData(): Promise<AdminUsersPageData> {
  const base = await loadAdminUsersBaseData({
    includeWorkspaces: false,
  });
  const usageData =
    adminUsersUsageDataCache.read(ADMIN_USERS_USAGE_DATA_CACHE_KEY) ??
    (await readPersistedAdminUsersUsageData());

  return applyAdminUsersUsageData(
    buildAdminUsersPageData(
      base,
      createPendingAdminUsersEnrichmentLookup(),
      base.errors,
      "pending",
    ),
    usageData,
  );
}

async function readPersistedAdminUsersPageData() {
  const entry = await readAdminSnapshotCache<AdminUsersPageData>(
    ADMIN_USERS_PAGE_DATA_CACHE_KEY,
  ).catch(() => null);

  if (!entry || entry.ageMs > ADMIN_USAGE_PERSISTED_STALE_MS) {
    return null;
  }

  adminUsersPageDataCache.set(ADMIN_USERS_PAGE_DATA_CACHE_KEY, entry.payload);
  return entry.payload;
}

export async function refreshAdminUsersPageData(): Promise<AdminUsersPageData> {
  if (adminUsersPageRefreshRequest) {
    return adminUsersPageRefreshRequest;
  }

  const request = loadAdminUsersPageData()
    .then(async (data) => {
      adminUsersPageDataCache.set(ADMIN_USERS_PAGE_DATA_CACHE_KEY, data);
      await writeAdminSnapshotCache(ADMIN_USERS_PAGE_DATA_CACHE_KEY, data).catch(
        () => undefined,
      );
      return data;
    })
    .finally(() => {
      if (adminUsersPageRefreshRequest === request) {
        adminUsersPageRefreshRequest = null;
      }
    });

  adminUsersPageRefreshRequest = request;
  return request;
}

export async function getAdminUsersPageData(): Promise<AdminUsersPageData> {
  const cached = adminUsersPageDataCache.read(ADMIN_USERS_PAGE_DATA_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const persisted = await readPersistedAdminUsersPageData();

  if (persisted) {
    return persisted;
  }

  return refreshAdminUsersPageData();
}

async function loadAdminUsersEnrichmentLookup(
  users: AppUserRecord[],
  workspaces: WorkspaceSnapshot[],
): Promise<{
  errors: string[];
  lookup: AdminUsersEnrichmentLookup;
}> {
  const errors: string[] = [];

  let bootstrapKey: string;
  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch (error) {
    errors.push(readErrorMessage(error));
    return {
      errors,
      lookup: {
        appImageUsage: createAdminAppImageUsageLookup(null),
        apps: [],
        billingByTenant: new Map<string, AdminTenantBillingLookup>(),
        loaded: true,
      },
    };
  }

  const userEmails = new Set(users.map((user) => user.email));
  const billingWorkspaces = workspaces.filter((workspace) =>
    userEmails.has(workspace.email),
  );
  const [appsResult, billingResult, imageUsageResult] =
    await Promise.allSettled([
      getCachedAdminAppsWithResourceUsage(bootstrapKey),
      getAdminUserBillingLookup(bootstrapKey, billingWorkspaces),
      getCachedAdminAppImageUsage(bootstrapKey),
    ]);

  let apps: FugueApp[] = [];
  let billingByTenant = new Map<string, AdminTenantBillingLookup>();
  let appImageUsage = createAdminAppImageUsageLookup(null);

  if (appsResult.status === "fulfilled") {
    apps = appsResult.value;
  } else {
    errors.push(`apps: ${readErrorMessage(appsResult.reason)}`);
  }

  if (billingResult.status === "fulfilled") {
    billingByTenant = billingResult.value.byTenant;
    errors.push(...billingResult.value.errors);
  } else {
    errors.push(`billing: ${readErrorMessage(billingResult.reason)}`);
  }

  if (imageUsageResult.status === "fulfilled") {
    appImageUsage = createAdminAppImageUsageLookup(imageUsageResult.value);
  }

  return {
    errors,
    lookup: {
      appImageUsage,
      apps,
      billingByTenant,
      loaded: true,
    },
  };
}

export async function getAdminUsersPageEnrichmentData(): Promise<AdminUsersPageData> {
  if (hasFreshAdminUsersEnrichmentData() && cachedAdminUsersEnrichmentData) {
    return cachedAdminUsersEnrichmentData;
  }

  if (adminUsersEnrichmentRequest) {
    return adminUsersEnrichmentRequest;
  }

  let request: Promise<AdminUsersPageData>;
  request = (async () => {
    const base = await loadAdminUsersBaseData({
      includeWorkspaces: true,
    });
    const enrichment = await loadAdminUsersEnrichmentLookup(
      base.users,
      base.workspaces,
    );
    const data = buildAdminUsersPageData(
      base,
      enrichment.lookup,
      [...base.errors, ...enrichment.errors],
      "ready",
    );

    cachedAdminUsersEnrichmentData = data;
    cachedAdminUsersEnrichmentAt = Date.now();
    return data;
  })().finally(() => {
    if (adminUsersEnrichmentRequest === request) {
      adminUsersEnrichmentRequest = null;
    }
  });

  adminUsersEnrichmentRequest = request;
  return request;
}

export function invalidateAdminUsersPageEnrichmentData() {
  cachedAdminUsersEnrichmentData = null;
  cachedAdminUsersEnrichmentAt = 0;
  adminUsersEnrichmentRequest = null;
  adminUsersPageRefreshRequest = null;
  adminUsersPageDataCache.clear(ADMIN_USERS_PAGE_DATA_CACHE_KEY);
  adminUsersUsageDataCache.clear(ADMIN_USERS_USAGE_DATA_CACHE_KEY);
  void Promise.allSettled([
    deleteAdminSnapshotCache(ADMIN_USERS_PAGE_DATA_CACHE_KEY),
    deleteAdminSnapshotCache(ADMIN_USERS_USAGE_DATA_CACHE_KEY),
  ]);
}

export async function updateAdminUserBillingForEmail(
  email: string,
  payload: {
    managedCap: FugueResourceSpec;
  },
) {
  const workspace = await getWorkspaceSnapshotByEmail(email);

  if (!workspace?.tenantId) {
    throw new Error("404 User has no workspace.");
  }

  const accessToken = getFugueEnv().bootstrapKey;
  const storageGibibytes =
    payload.managedCap.storageGibibytes ??
    (
      await getFugueBillingSummary(accessToken, workspace.tenantId, {
        includeCurrentUsage: false,
      })
    ).managedCap.storageGibibytes;

  const billing = await updateFugueBilling(accessToken, {
    managedCap: {
      ...payload.managedCap,
      storageGibibytes,
    },
    tenantId: workspace.tenantId,
  });

  invalidateAdminUsersPageEnrichmentData();
  return billing;
}

export async function setAdminUserBillingBalanceForEmail(
  email: string,
  payload: {
    balanceCents: number;
    note?: string;
  },
) {
  const workspace = await getWorkspaceSnapshotByEmail(email);

  if (!workspace?.tenantId) {
    throw new Error("404 User has no workspace.");
  }

  const billing = await setFugueBillingBalance(getFugueEnv().bootstrapKey, {
    balanceCents: payload.balanceCents,
    note: payload.note,
    tenantId: workspace.tenantId,
  });

  invalidateAdminUsersPageEnrichmentData();
  return billing;
}

function buildControlPlaneComponentView(
  component: FugueControlPlaneComponent,
): AdminControlPlaneComponentView {
  return {
    component: component.component,
    componentLabel: readControlPlaneComponentLabel(component.component),
    deploymentName: component.deploymentName || "Unresolved deployment",
    imageExact: component.image || "Unknown image",
    imageRepositoryLabel: shortImageRepository(component.imageRepository),
    imageTagExact: component.imageTag ?? "",
    imageTagLabel: component.imageTag
      ? shortControlPlaneVersion(component.imageTag)
      : "No tag",
    replicaLabel: `${component.readyReplicas}/${component.desiredReplicas} ready`,
    rolloutLabel: `${component.updatedReplicas} updated / ${component.availableReplicas} available`,
    statusLabel: readControlPlaneComponentStatusLabel(component.status),
    statusTone: readControlPlaneTone(component.status),
  };
}

function buildControlPlaneView(
  controlPlane: FugueControlPlaneStatus,
): AdminControlPlaneView {
  const components = [...(controlPlane.components ?? [])]
    .sort((left, right) => {
      const leftOrder =
        CONTROL_PLANE_COMPONENT_ORDER.get(left.component ?? "") ??
        Number.MAX_SAFE_INTEGER;
      const rightOrder =
        CONTROL_PLANE_COMPONENT_ORDER.get(right.component ?? "") ??
        Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return (left.component ?? "").localeCompare(right.component ?? "");
    })
    .map(buildControlPlaneComponentView);

  return {
    components,
    namespaceLabel: controlPlane.namespace || "Unknown namespace",
    observedExact: formatExactTime(controlPlane.observedAt),
    observedLabel: formatRelativeTime(controlPlane.observedAt),
    releaseInstanceLabel: controlPlane.releaseInstance || "Unknown release",
    statusLabel: readControlPlaneOverviewStatusLabel(controlPlane.status),
    statusTone: readControlPlaneTone(controlPlane.status),
    summaryLabel: readControlPlaneSummaryLabel(controlPlane.status),
    versionExact: controlPlane.version ?? "",
    versionLabel: readControlPlaneVersionLabel(
      controlPlane.status,
      controlPlane.version,
    ),
  };
}

async function getCachedAdminControlPlaneView(bootstrapKey: string) {
  return adminControlPlaneViewCache.getOrLoad("control-plane", async () =>
    buildControlPlaneView(await getFugueControlPlaneStatus(bootstrapKey)),
  );
}

export async function getAdminControlPlaneData(): Promise<{
  controlPlane: AdminControlPlaneView | null;
  errors: string[];
}> {
  let bootstrapKey: string;

  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch (error) {
    return {
      controlPlane: null,
      errors: [readErrorMessage(error)],
    };
  }

  try {
    return {
      controlPlane: await getCachedAdminControlPlaneView(bootstrapKey),
      errors: [],
    };
  } catch (error) {
    return {
      controlPlane: null,
      errors: [readErrorMessage(error)],
    };
  }
}

export async function getAdminClusterPageData(): Promise<AdminClusterPageData> {
  let bootstrapKey: string;

  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch (error) {
    return {
      controlPlane: null,
      errors: [readErrorMessage(error)],
      nodes: [],
      summary: {
        nodeCount: 0,
        pressuredCount: 0,
        readyCount: 0,
        workloadCount: 0,
      },
    };
  }

  const [nodesResult, tenantsResult, controlPlaneResult] = await Promise.all([
    settleResult(
      getFugueClusterNodes(bootstrapKey, {
        syncLocations: false,
      }),
    ),
    settleWithSoftTimeout(
      getFugueTenants(bootstrapKey),
      ADMIN_OPTIONAL_FETCH_TIMEOUT_MS,
    ),
    settleWithSoftTimeout(
      getCachedAdminControlPlaneView(bootstrapKey),
      ADMIN_OPTIONAL_FETCH_TIMEOUT_MS,
    ),
  ]);

  const errors = [
    tenantsResult.status === "rejected"
      ? `tenants: ${readErrorMessage(tenantsResult.reason)}`
      : null,
    nodesResult.status === "rejected"
      ? `cluster nodes: ${readErrorMessage(nodesResult.reason)}`
      : null,
    controlPlaneResult.status === "rejected"
      ? `control plane: ${readErrorMessage(controlPlaneResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const tenants =
    tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const nodes = nodesResult.status === "fulfilled" ? nodesResult.value : [];
  const controlPlane =
    controlPlaneResult.status === "fulfilled" ? controlPlaneResult.value : null;
  const views = buildClusterNodeViews(nodes, tenants);

  return {
    controlPlane,
    errors,
    nodes: views,
    summary: {
      nodeCount: views.length,
      pressuredCount: views.filter(
        (node) =>
          node.statusTone === "warning" ||
          node.statusTone === "danger" ||
          node.resources.some(
            (resource) =>
              resource.statusTone === "warning" ||
              resource.statusTone === "danger",
          ),
      ).length,
      readyCount: views.filter((node) => node.statusLabel === "Ready").length,
      workloadCount: views.reduce(
        (total, node) => total + node.workloadCount,
        0,
      ),
    },
  };
}

export async function setAdminClusterNodePolicy(
  nodeName: string,
  payload: {
    allowBuilds?: boolean;
    allowSharedPool?: boolean;
    desiredControlPlaneRole?: string;
  },
) {
  const bootstrapKey = getFugueEnv().bootstrapKey;
  const result = await setFugueClusterNodePolicy(
    bootstrapKey,
    nodeName,
    payload,
  );
  const tenants = await getFugueTenants(bootstrapKey).catch(
    () => [] as FugueTenant[],
  );
  const node = result.clusterNode
    ? (buildClusterNodeViews([result.clusterNode], tenants)[0] ?? null)
    : null;

  return {
    node,
    nodeReconciled: result.nodeReconciled,
    reconcileError: result.reconcileError,
  };
}

export async function createAdminPlatformNodeEnrollment(payload?: {
  label?: string;
}) {
  const env = getFugueEnv();
  const created = await createFugueNodeKey(env.bootstrapKey, {
    label: normalizeNodeKeyLabel(payload?.label),
    scope: "platform-node",
  });

  return {
    joinCommand: buildPlatformJoinCommand(
      env.apiUrl.replace(/\/+$/, ""),
      created.secret,
    ),
    nodeKey: {
      createdAt: created.nodeKey.createdAt,
      id: created.nodeKey.id,
      label: created.nodeKey.label,
      scope: created.nodeKey.scope,
      status: created.nodeKey.status,
    },
  } satisfies AdminPlatformNodeEnrollmentResult;
}
