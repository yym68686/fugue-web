import "server-only";

import { listAppUsers, type AppUserRecord } from "@/lib/app-users/store";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import {
  getFugueBillingSummary,
  getFugueApps,
  getFugueClusterNodes,
  getFugueControlPlaneStatus,
  getFugueProjects,
  getFugueTenants,
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
  type FugueResourceSpec,
  type FugueTenant,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import { readFugueSourceHref, readFugueSourceLabel } from "@/lib/fugue/source-display";
import {
  readTechStackBadgeKind,
  readTechnologyLabel,
  type TechStackBadgeKind,
} from "@/lib/tech-stack";
import { readCountryLocation } from "@/lib/geo/country";
import {
  getWorkspaceSnapshotByEmail,
  listWorkspaceSnapshots,
  type WorkspaceSnapshot,
} from "@/lib/workspace/store";

export type AdminClusterAppView = {
  canRebuild: boolean;
  id: string;
  name: string;
  ownerLabel: string;
  phase: string;
  phaseTone: ConsoleTone;
  projectLabel: string;
  resourceUsage: ConsoleCompactResourceItemView[];
  routeHref: string | null;
  routeLabel: string;
  runtimeLabel: string;
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
  updatedExact: string;
  updatedLabel: string;
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
};

export type AdminUserBillingView = {
  balanceLabel: string | null;
  balanceMicroCents: number | null;
  committedStorageGibibytes: number | null;
  cpuMillicores: number | null;
  limitLabel: string;
  loadError: string | null;
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
  memoryLabel: string;
  serviceCount: number;
  serviceCountLabel: string;
};

export type AdminUsersPageData = {
  errors: string[];
  summary: {
    adminCount: number;
    blockedCount: number;
    deletedCount: number;
    userCount: number;
  };
  users: AdminUserView[];
};

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
  conditions: AdminClusterConditionView[];
  createdExact: string;
  createdLabel: string;
  headerMeta: string;
  internalIpLabel: string;
  locationCountryCode: string | null;
  locationLabel: string;
  name: string;
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

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
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

function readControlPlaneVersionLabel(status?: string | null, version?: string | null) {
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
    const normalizedSlug = slug?.trim().toLowerCase() || label?.trim().toLowerCase() || "";
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
        ? (readTechnologyLabel(app.source.detectedProvider) ?? humanize(app.source.detectedProvider))
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
    (item) => item.kind === "stack" || item.kind === "language" || item.kind === "service",
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

  if (normalized.includes("ready") || normalized.includes("active") || normalized.includes("running")) {
    return "positive";
  }

  if (normalized.includes("deploy") || normalized.includes("build") || normalized.includes("pending")) {
    return "info";
  }

  if (normalized.includes("disable") || normalized.includes("blocked")) {
    return "warning";
  }

  if (normalized.includes("delete") || normalized.includes("fail") || normalized.includes("error")) {
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
) {
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name] as const),
  );
  const workspaceEmailsByTenant = new Map(
    workspaces.map((workspace) => [workspace.tenantId, workspace.email] as const),
  );
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  return [...apps]
    .sort(
      (left, right) =>
        parseTimestamp(right.status.updatedAt ?? right.updatedAt ?? right.createdAt) -
        parseTimestamp(left.status.updatedAt ?? left.updatedAt ?? left.createdAt),
    )
    .map((app) => {
      const route = readRouteInfo(app);
      const phase = app.status.phase ?? (app.spec.disabled ? "disabled" : "unknown");
      const runtimeId = app.status.currentRuntimeId ?? app.spec.runtimeId;
      const updatedAt = app.status.updatedAt ?? app.updatedAt ?? app.createdAt;

      return {
        canRebuild: canRebuildApp(app),
        id: app.id,
        name: app.name,
        ownerLabel: app.tenantId
          ? workspaceEmailsByTenant.get(app.tenantId) ??
            tenantNames.get(app.tenantId) ??
            shortId(app.tenantId)
          : "Unknown",
        phase: humanize(phase),
        phaseTone: toneForStatus(phase),
        projectLabel: app.projectId ? projectNames.get(app.projectId) ?? shortId(app.projectId) : "Unassigned",
        resourceUsage: buildAdminAppResourceUsage(app),
        routeHref: route.href,
        routeLabel: route.label,
        runtimeLabel: runtimeId ? shortId(runtimeId) : "Unassigned",
        sourceHref: readFugueSourceHref(app.source),
        sourceLabel: readFugueSourceLabel(app.source),
        stack: buildAppStack(app),
        updatedExact: formatExactTime(updatedAt),
        updatedLabel: formatRelativeTime(updatedAt),
      } satisfies AdminClusterAppView;
    });
}

async function getClusterProjects(
  bootstrapKey: string,
  tenants: FugueTenant[],
) {
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
  apps: FugueApp[],
  billingByTenant: Map<string, AdminTenantBillingLookup>,
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
  const tenantServiceUsageByTenant = buildAdminTenantServiceUsageLookup(apps);

  return users.map((user) => {
    const workspace = workspaceByEmail.get(user.email);
    const billing = workspace?.tenantId ? billingByTenant.get(workspace.tenantId) : undefined;
    const tenantServiceUsage = workspace?.tenantId
      ? tenantServiceUsageByTenant.get(workspace.tenantId)
      : undefined;
    const serviceCount = tenantServiceUsage?.serviceCount ?? 0;

    return {
      billing: buildAdminUserBillingView(workspace, billing),
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
      usage: buildAdminUserServiceUsageView(tenantServiceUsage),
      verified: user.verified,
    } satisfies AdminUserView;
  });
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
): AdminUserBillingView {
  if (!workspace?.tenantId) {
    return {
      balanceLabel: null,
      balanceMicroCents: null,
      committedStorageGibibytes: null,
      cpuMillicores: null,
      limitLabel: "No workspace",
      loadError: null,
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

  if (!billingLookup?.billing) {
    return {
      balanceLabel: null,
      balanceMicroCents: null,
      committedStorageGibibytes: null,
      cpuMillicores: null,
      limitLabel: "Billing unavailable",
      loadError: billingLookup?.error ?? "Fugue billing is unavailable for this workspace.",
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

function formatPercentLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "No stats";
  }

  return `${formatCompactNumber(value, 1)}%`;
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

function formatCPUCapacityLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "No stats";
  }

  if (Math.abs(value) >= 1000) {
    const cores = value / 1000;
    return `${formatCompactNumber(cores, 1)} ${cores === 1 ? "core" : "cores"}`;
  }

  return `${Math.round(value)} millicores`;
}

type AdminTenantServiceUsageSummary = {
  appIds: Set<string>;
  backingServiceIds: Set<string>;
  cpuMillicores: number | null;
  ephemeralStorageBytes: number | null;
  memoryBytes: number | null;
  serviceCount: number;
};

function createAdminTenantServiceUsageSummary(): AdminTenantServiceUsageSummary {
  return {
    appIds: new Set<string>(),
    backingServiceIds: new Set<string>(),
    cpuMillicores: null,
    ephemeralStorageBytes: null,
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

function buildAdminTenantServiceUsageLookup(apps: FugueApp[]) {
  const byTenant = new Map<string, AdminTenantServiceUsageSummary>();

  for (const app of apps) {
    if (!app.tenantId) {
      continue;
    }

    const summary =
      byTenant.get(app.tenantId) ?? createAdminTenantServiceUsageSummary();

    if (!byTenant.has(app.tenantId)) {
      byTenant.set(app.tenantId, summary);
    }

    if (!summary.appIds.has(app.id)) {
      summary.appIds.add(app.id);
      summary.serviceCount += 1;
      appendResourceUsage(summary, app.currentResourceUsage);
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
): AdminUserServiceUsageView {
  const serviceCount = summary?.serviceCount ?? 0;

  return {
    cpuLabel: formatCPUCapacityLabel(summary?.cpuMillicores),
    diskLabel: formatBytesLabel(summary?.ephemeralStorageBytes),
    memoryLabel: formatBytesLabel(summary?.memoryBytes),
    serviceCount,
    serviceCountLabel: formatCountLabel(serviceCount, "service"),
  };
}

function buildResourceTitle(label: string, primaryLabel: string, secondaryLabel?: string | null) {
  return secondaryLabel ? `${label} / ${primaryLabel} / ${secondaryLabel}` : `${label} / ${primaryLabel}`;
}

function buildAdminAppResourceUsage(app: FugueApp): ConsoleCompactResourceItemView[] {
  const usage = app.currentResourceUsage;
  const cpuPrimaryLabel = formatCPUCapacityLabel(usage?.cpuMillicores);
  const memoryPrimaryLabel = formatBytesLabel(usage?.memoryBytes);
  const diskPrimaryLabel = formatBytesLabel(usage?.ephemeralStorageBytes);
  const hasCpuUsage = usage?.cpuMillicores !== null && usage?.cpuMillicores !== undefined;
  const hasMemoryUsage = usage?.memoryBytes !== null && usage?.memoryBytes !== undefined;
  const hasDiskUsage =
    usage?.ephemeralStorageBytes !== null && usage?.ephemeralStorageBytes !== undefined;

  return [
    {
      id: "cpu",
      label: "CPU",
      meterValue: null,
      primaryLabel: cpuPrimaryLabel,
      secondaryLabel: null,
      title: buildResourceTitle("CPU", cpuPrimaryLabel, hasCpuUsage ? "Current live sample" : null),
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

function readResourceTone(percent?: number | null, dangerSignal = false): ConsoleTone {
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

function readResourceStatusLabel(percent?: number | null, dangerSignal = false) {
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

function readConditionTone(conditionID: string, status?: string | null): ConsoleTone {
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

function buildCPUResourceView(stats: FugueClusterNodeCPUStats | null): AdminClusterResourceView {
  const percent = stats?.usagePercent ?? null;
  const total = stats?.allocatableMilliCores ?? stats?.capacityMilliCores ?? null;

  return {
    detailLabel:
      stats?.capacityMilliCores !== null && stats?.capacityMilliCores !== undefined
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

function buildClusterConditionViews(node: FugueClusterNode): AdminClusterConditionView[] {
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
        detail || (transitionedAt ? `Updated ${formatRelativeTime(transitionedAt)}` : "No signal reported"),
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

function buildClusterWorkloadViews(
  workloads: FugueClusterNodeWorkload[],
  tenantNames: Map<string, string>,
) {
  return workloads.map((workload) => {
    const tenantLabel = workload.tenantId
      ? tenantNames.get(workload.tenantId) ?? shortId(workload.tenantId)
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

function buildClusterNodeViews(
  nodes: FugueClusterNode[],
  tenants: FugueTenant[],
) {
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  const views = nodes.map((node) => {
    const conditionViews = buildClusterConditionViews(node);
    const memoryPressure = isConditionActive(node.conditions[CLUSTER_MEMORY_PRESSURE_CONDITION]?.status);
    const diskPressure = isConditionActive(node.conditions[CLUSTER_DISK_PRESSURE_CONDITION]?.status);
    const pressureSignals = conditionViews.filter(
      (condition) =>
        condition.id !== CLUSTER_READY_CONDITION &&
        condition.statusLabel === "Pressure",
    );
    const workloadCount = node.workloads.length;
    const appCount = node.workloads.filter((workload) => workload.kind === "app").length;
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
      conditions: conditionViews,
      createdExact: formatExactTime(node.createdAt),
      createdLabel: formatRelativeTime(node.createdAt),
      headerMeta: statusFragments.join(" · "),
      internalIpLabel: node.internalIp?.trim() || "Unavailable",
      locationCountryCode: location.locationCountryCode,
      locationLabel,
      name: node.name,
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
        ? tenantNames.get(node.tenantId) ?? shortId(node.tenantId)
        : node.runtimeId
          ? "Shared"
          : "Unassigned",
      workloadCount,
      workloads: buildClusterWorkloadViews(node.workloads, tenantNames),
      zoneLabel: node.zone?.trim() || "Unassigned",
    } satisfies AdminClusterNodeView;
  });

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

export async function getAdminAppsPageData(): Promise<AdminAppsPageData> {
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

  const [tenantsResult, appsResult, workspacesResult] = await Promise.allSettled([
    getFugueTenants(bootstrapKey),
    getFugueApps(bootstrapKey),
    listWorkspaceSnapshots(),
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
  ].filter((value): value is string => Boolean(value));

  const tenants = tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const workspaces = workspacesResult.status === "fulfilled" ? workspacesResult.value : [];
  const projectData =
    tenantsResult.status === "fulfilled"
      ? await getClusterProjects(bootstrapKey, tenants)
      : { errors: [], projects: [] };
  const projects = projectData.projects;
  errors.push(...projectData.errors);
  const views = mapAdminApps(apps, projects, workspaces, tenants);

  return {
    apps: views,
    errors,
    summary: {
      appCount: views.length,
      latestUpdateLabel: views[0]?.updatedLabel ?? "Not yet",
      routedCount: views.filter((app) => app.routeLabel !== "Unassigned").length,
      tenantCount: new Set(apps.map((app) => app.tenantId).filter(Boolean)).size,
    },
  };
}

async function getAdminUserBillingLookup(
  bootstrapKey: string,
  workspaces: WorkspaceSnapshot[],
) {
  const uniqueWorkspaces = [...new Map(
    workspaces
      .filter((workspace) => workspace.tenantId)
      .map((workspace) => [workspace.tenantId, workspace] as const),
  ).values()];

  if (!uniqueWorkspaces.length) {
    return {
      byTenant: new Map<string, AdminTenantBillingLookup>(),
      errors: [],
    };
  }

  const billingResults = await Promise.allSettled(
    uniqueWorkspaces.map((workspace) =>
      getFugueBillingSummary(bootstrapKey, workspace.tenantId),
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
    errors.push(`billing (${workspace.tenantName || workspace.tenantId}): ${message}`);
  }

  return {
    byTenant,
    errors,
  };
}

export async function getAdminUsersPageData(): Promise<AdminUsersPageData> {
  const [usersResult, workspacesResult] = await Promise.allSettled([
    listAppUsers(),
    listWorkspaceSnapshots(),
  ]);

  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  const workspaces = workspacesResult.status === "fulfilled" ? workspacesResult.value : [];
  const errors = [
    usersResult.status === "rejected" ? `users: ${readErrorMessage(usersResult.reason)}` : null,
    workspacesResult.status === "rejected"
      ? `workspaces: ${readErrorMessage(workspacesResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  let apps: FugueApp[] = [];
  let billingByTenant = new Map<string, AdminTenantBillingLookup>();

  try {
    const bootstrapKey = getFugueEnv().bootstrapKey;
    const userEmails = new Set(users.map((user) => user.email));
    const billingWorkspaces = workspaces.filter((workspace) => userEmails.has(workspace.email));
    const [appsResult, billingResult] = await Promise.allSettled([
      getFugueApps(bootstrapKey),
      getAdminUserBillingLookup(bootstrapKey, billingWorkspaces),
    ]);

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
  } catch (error) {
    errors.push(readErrorMessage(error));
  }

  const views = buildUserViews(users, workspaces, apps, billingByTenant);

  return {
    errors,
    summary: {
      adminCount: views.filter((user) => user.isAdmin).length,
      blockedCount: views.filter((user) => user.status === "blocked").length,
      deletedCount: views.filter((user) => user.status === "deleted").length,
      userCount: views.length,
    },
    users: views,
  };
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
    (await getFugueBillingSummary(accessToken, workspace.tenantId)).managedCap.storageGibibytes;

  return updateFugueBilling(accessToken, {
    managedCap: {
      ...payload.managedCap,
      storageGibibytes,
    },
    tenantId: workspace.tenantId,
  });
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

  return setFugueBillingBalance(getFugueEnv().bootstrapKey, {
    balanceCents: payload.balanceCents,
    note: payload.note,
    tenantId: workspace.tenantId,
  });
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

  const [tenantsResult, nodesResult, controlPlaneResult] = await Promise.allSettled([
    getFugueTenants(bootstrapKey),
    getFugueClusterNodes(bootstrapKey),
    getFugueControlPlaneStatus(bootstrapKey),
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

  const tenants = tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const nodes = nodesResult.status === "fulfilled" ? nodesResult.value : [];
  const controlPlane =
    controlPlaneResult.status === "fulfilled"
      ? buildControlPlaneView(controlPlaneResult.value)
      : null;
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
              resource.statusTone === "warning" || resource.statusTone === "danger",
          ),
      ).length,
      readyCount: views.filter((node) => node.statusLabel === "Ready").length,
      workloadCount: views.reduce((total, node) => total + node.workloadCount, 0),
    },
  };
}
