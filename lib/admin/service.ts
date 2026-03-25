import "server-only";

import { listAppUsers, type AppUserRecord } from "@/lib/app-users/store";
import type { ConsoleTone } from "@/lib/console/types";
import {
  getFugueApps,
  getFugueClusterNodes,
  getFugueProjects,
  getFugueTenants,
  type FugueApp,
  type FugueClusterNode,
  type FugueClusterNodeCPUStats,
  type FugueClusterNodeMemoryStats,
  type FugueClusterNodeStorageStats,
  type FugueClusterNodeWorkload,
  type FugueProject,
  type FugueTenant,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import { listWorkspaceSnapshots, type WorkspaceSnapshot } from "@/lib/workspace/store";

export type AdminClusterAppView = {
  canRebuild: boolean;
  id: string;
  name: string;
  phase: string;
  phaseTone: ConsoleTone;
  projectLabel: string;
  routeHref: string | null;
  routeLabel: string;
  runtimeLabel: string;
  sourceLabel: string;
  stack: Array<{
    id: string;
    kind: string;
    label: string;
    meta: string;
    title: string;
  }>;
  tenantLabel: string;
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
  canBlock: boolean;
  canDelete: boolean;
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
  tenantLabel: string;
  verified: boolean;
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
  externalIpLabel: string;
  headerMeta: string;
  internalIpLabel: string;
  locationLabel: string;
  name: string;
  roleLabels: string[];
  resources: AdminClusterResourceView[];
  runtimeLabel: string;
  serviceCount: number;
  statusDetail: string;
  statusLabel: string;
  statusTone: ConsoleTone;
  tenantLabel: string;
  workloadCount: number;
  workloads: AdminClusterWorkloadView[];
  zoneLabel: string;
};

export type AdminClusterPageData = {
  errors: string[];
  nodes: AdminClusterNodeView[];
  summary: {
    nodeCount: number;
    pressuredCount: number;
    readyCount: number;
    workloadCount: number;
  };
};

const REBUILDABLE_APP_SOURCE_TYPES = new Set(["github-public", "upload"]);
const CLUSTER_READY_CONDITION = "Ready";
const CLUSTER_MEMORY_PRESSURE_CONDITION = "MemoryPressure";
const CLUSTER_DISK_PRESSURE_CONDITION = "DiskPressure";
const CLUSTER_PID_PRESSURE_CONDITION = "PIDPressure";

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

function readProviderLabel(value?: string | null) {
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
      return null;
  }
}

function normalizeTechKind(value?: string | null) {
  return value?.trim().toLowerCase() || "stack";
}

function canRebuildApp(app: FugueApp) {
  const sourceType = app.source.type?.trim().toLowerCase() ?? "";
  return REBUILDABLE_APP_SOURCE_TYPES.has(sourceType);
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
        ? (readProviderLabel(app.source.detectedProvider) ?? humanize(app.source.detectedProvider))
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
    ["language", 0],
    ["service", 1],
    ["build", 2],
  ]);
  const primary = items.filter(
    (item) => item.kind === "language" || item.kind === "service",
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

function formatRepoLabel(app: FugueApp) {
  const repoUrl = app.source.repoUrl?.trim();
  const branch = app.source.repoBranch?.trim();

  if (!repoUrl) {
    return humanize(app.source.type);
  }

  const compact = repoUrl
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");

  return branch ? `${compact} / ${branch}` : compact;
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
  tenants: FugueTenant[],
) {
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name] as const),
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
        phase: humanize(phase),
        phaseTone: toneForStatus(phase),
        projectLabel: app.projectId ? projectNames.get(app.projectId) ?? shortId(app.projectId) : "Unassigned",
        routeHref: route.href,
        routeLabel: route.label,
        runtimeLabel: runtimeId ? shortId(runtimeId) : "Unassigned",
        sourceLabel: formatRepoLabel(app),
        stack: buildAppStack(app),
        tenantLabel: app.tenantId ? tenantNames.get(app.tenantId) ?? shortId(app.tenantId) : "Unknown",
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
  tenants: FugueTenant[],
) {
  const workspaceByEmail = new Map(
    workspaces.map((workspace) => [workspace.email, workspace] as const),
  );
  const appCountByTenant = new Map<string, number>();
  const tenantNames = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name] as const),
  );

  for (const app of apps) {
    if (!app.tenantId) {
      continue;
    }

    appCountByTenant.set(app.tenantId, (appCountByTenant.get(app.tenantId) ?? 0) + 1);
  }

  return users.map((user) => {
    const workspace = workspaceByEmail.get(user.email);
    const serviceCount =
      workspace?.tenantId ? (appCountByTenant.get(workspace.tenantId) ?? 0) : 0;

    return {
      canBlock: !user.isAdmin && user.status === "active",
      canDelete: !user.isAdmin && user.status !== "deleted",
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
      tenantLabel:
        workspace?.tenantId
          ? tenantNames.get(workspace.tenantId) ?? workspace.tenantName ?? shortId(workspace.tenantId)
          : "No workspace",
      verified: user.verified,
    } satisfies AdminUserView;
  });
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatCompactNumber(value: number, digits = 1) {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });

  return formatter.format(value);
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

function readLocationLabel(region?: string | null, zone?: string | null) {
  const parts = [region?.trim(), zone?.trim()].filter(
    (value): value is string => Boolean(value),
  );

  return parts.length ? parts.join(" / ") : "Unassigned";
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
    const locationLabel = readLocationLabel(node.region, node.zone);
    const statusFragments = [
      locationLabel !== "Unassigned" ? locationLabel : null,
      pressureSignals.length
        ? `${pressureSignals.map((condition) => condition.label.toLowerCase()).join(" + ")} signal${
            pressureSignals.length === 1 ? "" : "s"
          }`
        : node.status?.trim().toLowerCase() === "ready"
          ? "No active pressure"
          : null,
      formatCountLabel(workloadCount, "workload"),
    ].filter((value): value is string => Boolean(value));

    return {
      appCount,
      conditions: conditionViews,
      createdExact: formatExactTime(node.createdAt),
      createdLabel: formatRelativeTime(node.createdAt),
      externalIpLabel: node.externalIp?.trim() || "Unavailable",
      headerMeta: statusFragments.join(" · "),
      internalIpLabel: node.internalIp?.trim() || "Unavailable",
      locationLabel,
      name: node.name,
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
          ? `${pressureSignals.map((condition) => `${condition.label.toLowerCase()} pressure`).join(" / ")}`
          : node.status?.trim().toLowerCase() === "ready"
            ? "Ready with no active memory, disk, or process pressure."
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

  const [tenantsResult, appsResult] = await Promise.allSettled([
    getFugueTenants(bootstrapKey),
    getFugueApps(bootstrapKey),
  ]);

  const errors = [
    tenantsResult.status === "rejected"
      ? `tenants: ${readErrorMessage(tenantsResult.reason)}`
      : null,
    appsResult.status === "rejected"
      ? `apps: ${readErrorMessage(appsResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const tenants = tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const projectData =
    tenantsResult.status === "fulfilled"
      ? await getClusterProjects(bootstrapKey, tenants)
      : { errors: [], projects: [] };
  const projects = projectData.projects;
  errors.push(...projectData.errors);
  const views = mapAdminApps(apps, projects, tenants);

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
  let tenants: FugueTenant[] = [];

  try {
    const bootstrapKey = getFugueEnv().bootstrapKey;
    const [appsResult, tenantsResult] = await Promise.allSettled([
      getFugueApps(bootstrapKey),
      getFugueTenants(bootstrapKey),
    ]);

    if (appsResult.status === "fulfilled") {
      apps = appsResult.value;
    } else {
      errors.push(`apps: ${readErrorMessage(appsResult.reason)}`);
    }

    if (tenantsResult.status === "fulfilled") {
      tenants = tenantsResult.value;
    } else {
      errors.push(`tenants: ${readErrorMessage(tenantsResult.reason)}`);
    }
  } catch (error) {
    errors.push(readErrorMessage(error));
  }

  const views = buildUserViews(users, workspaces, apps, tenants);

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

export async function getAdminClusterPageData(): Promise<AdminClusterPageData> {
  let bootstrapKey: string;

  try {
    bootstrapKey = getFugueEnv().bootstrapKey;
  } catch (error) {
    return {
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

  const [tenantsResult, nodesResult] = await Promise.allSettled([
    getFugueTenants(bootstrapKey),
    getFugueClusterNodes(bootstrapKey),
  ]);

  const errors = [
    tenantsResult.status === "rejected"
      ? `tenants: ${readErrorMessage(tenantsResult.reason)}`
      : null,
    nodesResult.status === "rejected"
      ? `cluster nodes: ${readErrorMessage(nodesResult.reason)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const tenants = tenantsResult.status === "fulfilled" ? tenantsResult.value : [];
  const nodes = nodesResult.status === "fulfilled" ? nodesResult.value : [];
  const views = buildClusterNodeViews(nodes, tenants);

  return {
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
