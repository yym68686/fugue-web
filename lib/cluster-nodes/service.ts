import "server-only";

import type { ConsoleTone } from "@/lib/console/types";
import {
  getFugueClusterNodes,
  getFugueRuntimes,
  type FugueClusterNode,
  type FugueClusterNodeCPUStats,
  type FugueClusterNodeMemoryStats,
  type FugueClusterNodeStorageStats,
  type FugueClusterNodeWorkload,
  type FugueRuntime,
} from "@/lib/fugue/api";
import { readCountryLocation } from "@/lib/geo/country";
import { readManagedSharedRuntimeLabel } from "@/lib/fugue/runtime-location";
import { readRuntimePublicOfferDescription } from "@/lib/runtimes/public-offer";
import type {
  RuntimeOwnership,
  RuntimePublicOfferView,
} from "@/lib/runtimes/types";
import {
  getWorkspaceAccessByEmail,
  getWorkspaceSnapshotByTenantId,
} from "@/lib/workspace/store";

export type ClusterNodeConditionView = {
  detailLabel: string;
  id: string;
  label: string;
  lastTransitionExact: string;
  lastTransitionLabel: string;
  statusLabel: string;
  tone: ConsoleTone;
};

export type ClusterNodeResourceView = {
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

export type ClusterNodeWorkloadView = {
  id: string;
  kindLabel: string;
  kindTone: ConsoleTone;
  metaLabel: string;
  name: string;
  title: string;
};

export type ClusterNodeView = {
  accessMode: string | null;
  appCount: number;
  canManageSharing: boolean;
  conditions: ClusterNodeConditionView[];
  createdExact: string;
  createdLabel: string;
  headerMeta: string;
  heartbeatExact: string;
  heartbeatLabel: string;
  internalIpLabel: string;
  locationCountryCode: string | null;
  locationLabel: string;
  machineLabel: string;
  name: string;
  ownerEmail: string | null;
  ownerLabel: string;
  ownership: RuntimeOwnership;
  poolMode: string | null;
  publicOffer: RuntimePublicOfferView | null;
  publicIpLabel: string;
  roleLabels: string[];
  resources: ClusterNodeResourceView[];
  runtimeId: string | null;
  runtimeLabel: string;
  runtimeStatusLabel: string;
  runtimeStatusTone: ConsoleTone;
  runtimeType: string | null;
  serviceCount: number;
  statusDetail?: string | null;
  statusLabel: string;
  statusTone: ConsoleTone;
  workloadCount: number;
  workloads: ClusterNodeWorkloadView[];
  zoneLabel: string;
};

export type ClusterNodesPageData = {
  errors: string[];
  nodes: ClusterNodeView[];
  summary: {
    latestHeartbeatLabel: string;
    nodeCount: number;
    readyCount: number;
    workloadCount: number;
  };
};

const CLUSTER_READY_CONDITION = "Ready";
const CLUSTER_MEMORY_PRESSURE_CONDITION = "MemoryPressure";
const CLUSTER_DISK_PRESSURE_CONDITION = "DiskPressure";
const CLUSTER_PID_PRESSURE_CONDITION = "PIDPressure";

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
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

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
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

function readOwnerTenantId(
  node: FugueClusterNode,
  runtime: FugueRuntime | null,
) {
  return runtime?.tenantId ?? node.tenantId ?? null;
}

function readRuntimeOwnership(
  node: FugueClusterNode,
  runtime: FugueRuntime | null,
  workspaceTenantId: string,
): RuntimeOwnership {
  if (runtime?.type?.trim().toLowerCase() === "managed-shared") {
    return "internal-cluster";
  }

  const ownerTenantId = readOwnerTenantId(node, runtime);

  if (ownerTenantId && ownerTenantId === workspaceTenantId) {
    return "owned";
  }

  return "shared";
}

function readOwnerLabel(
  ownerTenantId: string | null,
  ownerEmailByTenantId: Map<string, string>,
) {
  if (!ownerTenantId) {
    return "Unknown owner";
  }

  return ownerEmailByTenantId.get(ownerTenantId) ?? shortId(ownerTenantId);
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

function readRuntimeTimestamp(runtime: FugueRuntime) {
  return parseTimestamp(
    runtime.lastHeartbeatAt ??
      runtime.lastSeenAt ??
      runtime.updatedAt ??
      runtime.createdAt,
  );
}

function readRuntimeLabel(runtime: FugueRuntime) {
  if (runtime.type === "managed-shared") {
    return readManagedSharedRuntimeLabel(runtime);
  }

  return runtime.name ?? runtime.machineName ?? shortId(runtime.id);
}

function buildCPUResourceView(
  stats: FugueClusterNodeCPUStats | null,
): ClusterNodeResourceView {
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
): ClusterNodeResourceView {
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
): ClusterNodeResourceView {
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
): ClusterNodeConditionView[] {
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
    } satisfies ClusterNodeConditionView;
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

function buildClusterWorkloadViews(workloads: FugueClusterNodeWorkload[]) {
  return workloads.map((workload) => {
    const podCount = workload.podCount || workload.pods.length;
    const kindLabel =
      workload.kind === "backing_service"
        ? workload.serviceType
          ? humanize(workload.serviceType)
          : "Service"
        : "App";
    const metaParts = [
      formatCountLabel(podCount, "pod"),
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
      metaLabel: metaParts.join(" / ") || "Waiting for workload details",
      name: workload.name,
      title: `${workload.name} / ${kindLabel} / ${metaParts.join(" / ")} / ${podLabel}`,
    } satisfies ClusterNodeWorkloadView;
  });
}

function resolveRuntimeForNode(
  node: FugueClusterNode,
  runtimeById: Map<string, FugueRuntime>,
  runtimeByNodeName: Map<string, FugueRuntime>,
) {
  if (node.runtimeId && runtimeById.has(node.runtimeId)) {
    return runtimeById.get(node.runtimeId) ?? null;
  }

  return runtimeByNodeName.get(node.name) ?? null;
}

function buildClusterNodeViews(
  nodes: FugueClusterNode[],
  runtimes: FugueRuntime[],
  workspaceTenantId: string,
  ownerEmailByTenantId: Map<string, string>,
) {
  const runtimeById = new Map(
    runtimes.map((runtime) => [runtime.id, runtime] as const),
  );
  const runtimeByNodeName = new Map(
    runtimes
      .filter((runtime) => runtime.clusterNodeName)
      .map((runtime) => [runtime.clusterNodeName as string, runtime] as const),
  );
  const visibleNodes = nodes;

  const views = visibleNodes.map((node) => {
    const runtime = resolveRuntimeForNode(node, runtimeById, runtimeByNodeName);
    const ownership = readRuntimeOwnership(node, runtime, workspaceTenantId);
    const ownerTenantId = readOwnerTenantId(node, runtime);
    const ownerLabel = readOwnerLabel(ownerTenantId, ownerEmailByTenantId);
    const ownerEmail = ownerTenantId
      ? (ownerEmailByTenantId.get(ownerTenantId) ?? null)
      : null;
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
    const heartbeatAt = runtime?.lastHeartbeatAt ?? runtime?.lastSeenAt ?? null;
    const isPublicRuntime =
      runtime?.accessMode?.trim().toLowerCase() === "public";
    const publicOfferDescription = isPublicRuntime
      ? readRuntimePublicOfferDescription(runtime?.publicOffer)
      : null;
    const ownershipLabel =
      ownership === "shared"
        ? isPublicRuntime
          ? ownerEmail
            ? `Public by ${ownerEmail}`
            : "Public server"
          : ownerEmail
            ? `Shared by ${ownerEmail}`
            : "Shared with this workspace"
        : ownership === "internal-cluster"
          ? "Internal cluster capacity"
          : isPublicRuntime
            ? "Public access enabled"
            : runtime?.poolMode?.trim().toLowerCase() === "internal-shared"
              ? "Internal cluster enabled"
              : null;
    const statusFragments = [
      locationLabel !== "Unassigned" ? locationLabel : null,
      heartbeatAt
        ? `heartbeat ${formatRelativeTime(heartbeatAt)}`
        : "Waiting for first heartbeat",
      ownershipLabel,
      formatCountLabel(workloadCount, "workload"),
    ].filter((value): value is string => Boolean(value));
    const ownershipDetail =
      ownership === "shared"
        ? isPublicRuntime
          ? ownerEmail
            ? `Public by ${ownerEmail}. ${publicOfferDescription}`
            : publicOfferDescription
          : ownerEmail
            ? `Shared by ${ownerEmail}.`
            : "Shared with your workspace."
        : ownership === "internal-cluster"
          ? "Part of Fugue shared capacity."
          : isPublicRuntime
            ? `Any workspace can deploy here. ${publicOfferDescription}`
            : runtime?.poolMode?.trim().toLowerCase() === "internal-shared"
              ? "Internal cluster can also deploy here."
              : null;

    return {
      accessMode: runtime?.accessMode ?? null,
      appCount,
      canManageSharing: ownership === "owned" && Boolean(runtime?.id),
      conditions: conditionViews,
      createdExact: formatExactTime(node.createdAt),
      createdLabel: formatRelativeTime(node.createdAt),
      headerMeta: statusFragments.join(" · "),
      heartbeatExact: formatExactTime(heartbeatAt),
      heartbeatLabel: formatRelativeTime(heartbeatAt),
      internalIpLabel: node.internalIp?.trim() || "Unavailable",
      locationCountryCode: location.locationCountryCode,
      locationLabel,
      machineLabel:
        runtime?.machineName?.trim() || runtime?.name?.trim() || node.name,
      name: node.name,
      ownerEmail,
      ownerLabel,
      ownership,
      poolMode: runtime?.poolMode ?? null,
      publicOffer: runtime?.publicOffer ?? null,
      publicIpLabel: node.publicIp?.trim() || "Unavailable",
      roleLabels: node.roles.length ? node.roles : [],
      resources: [
        buildCPUResourceView(node.cpu),
        buildMemoryResourceView(node.memory, memoryPressure),
        buildStorageResourceView(node.ephemeralStorage, diskPressure),
      ],
      runtimeId: runtime?.id ?? node.runtimeId ?? null,
      runtimeLabel: runtime
        ? readRuntimeLabel(runtime)
        : node.runtimeId
          ? shortId(node.runtimeId)
          : "Awaiting runtime",
      runtimeStatusLabel: runtime
        ? humanize(runtime.status)
        : "Awaiting runtime",
      runtimeStatusTone: runtime ? toneForStatus(runtime.status) : "neutral",
      runtimeType: runtime?.type ?? null,
      serviceCount,
      statusDetail:
        pressureSignals.length > 0
          ? `${joinConditionLabels(
              pressureSignals.map((condition) => condition.label.toLowerCase()),
            )} pressure reported.`
          : node.status?.trim().toLowerCase() === "ready"
            ? ownershipDetail
            : "Waiting for complete node health telemetry.",
      statusLabel,
      statusTone,
      workloadCount,
      workloads: buildClusterWorkloadViews(node.workloads),
      zoneLabel: node.zone?.trim() || "Unassigned",
    } satisfies ClusterNodeView;
  });

  const latestHeartbeatTimestamp = visibleNodes.reduce((latest, node) => {
    const runtime = resolveRuntimeForNode(node, runtimeById, runtimeByNodeName);
    const next = runtime ? readRuntimeTimestamp(runtime) : 0;
    return Math.max(latest, next);
  }, 0);

  return {
    latestHeartbeatAt: latestHeartbeatTimestamp
      ? new Date(latestHeartbeatTimestamp).toISOString()
      : null,
    views: views.sort((left, right) => {
      const leftTone = Math.max(
        toneWeight(left.statusTone),
        toneWeight(left.runtimeStatusTone),
        ...left.resources.map((resource) => toneWeight(resource.statusTone)),
      );
      const rightTone = Math.max(
        toneWeight(right.statusTone),
        toneWeight(right.runtimeStatusTone),
        ...right.resources.map((resource) => toneWeight(resource.statusTone)),
      );

      if (leftTone !== rightTone) {
        return rightTone - leftTone;
      }

      if (left.workloadCount !== right.workloadCount) {
        return right.workloadCount - left.workloadCount;
      }

      return left.name.localeCompare(right.name);
    }),
  };
}

export async function getClusterNodesPageData(
  email: string,
): Promise<ClusterNodesPageData | null> {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    return null;
  }

  const [nodesResult, runtimesResult] = await Promise.allSettled([
    getFugueClusterNodes(workspace.adminKeySecret),
    getFugueRuntimes(workspace.adminKeySecret, {
      syncLocations: false,
    }),
  ]);

  const errors: string[] = [];
  const nodes = nodesResult.status === "fulfilled" ? nodesResult.value : [];
  const runtimes =
    runtimesResult.status === "fulfilled" ? runtimesResult.value : [];

  if (nodesResult.status === "rejected") {
    errors.push(`cluster nodes: ${readErrorMessage(nodesResult.reason)}`);
  }

  if (runtimesResult.status === "rejected") {
    errors.push(`runtimes: ${readErrorMessage(runtimesResult.reason)}`);
  }

  const ownerTenantIds = new Set<string>();

  for (const runtime of runtimes) {
    if (runtime.tenantId?.trim()) {
      ownerTenantIds.add(runtime.tenantId.trim());
    }
  }

  for (const node of nodes) {
    if (node.tenantId?.trim()) {
      ownerTenantIds.add(node.tenantId.trim());
    }
  }

  const ownerEmailByTenantId = new Map<string, string>();
  const ownerSnapshots = await Promise.allSettled(
    [...ownerTenantIds].map(async (tenantId) => ({
      snapshot: await getWorkspaceSnapshotByTenantId(tenantId),
      tenantId,
    })),
  );

  for (const result of ownerSnapshots) {
    if (result.status === "fulfilled") {
      if (result.value.snapshot?.email) {
        ownerEmailByTenantId.set(
          result.value.tenantId,
          result.value.snapshot.email,
        );
      }
      continue;
    }

    errors.push(`workspace owners: ${readErrorMessage(result.reason)}`);
  }

  const built = buildClusterNodeViews(
    nodes,
    runtimes,
    workspace.tenantId,
    ownerEmailByTenantId,
  );
  const readyCount = built.views.filter(
    (node) => node.statusTone === "positive",
  ).length;
  const workloadCount = built.views.reduce(
    (total, node) => total + node.workloadCount,
    0,
  );

  return {
    errors,
    nodes: built.views,
    summary: {
      latestHeartbeatLabel: formatRelativeTime(built.latestHeartbeatAt),
      nodeCount: built.views.length,
      readyCount,
      workloadCount,
    },
  } satisfies ClusterNodesPageData;
}
