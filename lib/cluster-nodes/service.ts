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
import {
  readManagedSharedRuntimeLabel,
  readRuntimeLocation,
} from "@/lib/fugue/runtime-location";
import { readRuntimePublicOfferDescription } from "@/lib/runtimes/public-offer";
import type {
  RuntimeOwnership,
  RuntimePublicOfferView,
} from "@/lib/runtimes/types";
import {
  getWorkspaceAccessByEmail,
  getWorkspaceSnapshotsByTenantIds,
} from "@/lib/workspace/store";
import {
  createTranslator,
  formatDateTime as formatLocaleDateTime,
  formatNumber as formatLocaleNumber,
  formatRelativeTime as formatLocaleRelativeTime,
  type Locale,
} from "@/lib/i18n/core";

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

export type OfflineServerView = {
  accessMode: string | null;
  clusterNodeNameLabel: string;
  connectionLabel: string;
  createdExact: string;
  createdLabel: string;
  endpointLabel: string;
  headerMeta: string;
  lastContactExact: string;
  lastContactLabel: string;
  locationCountryCode: string | null;
  locationLabel: string;
  machineLabel: string;
  name: string;
  poolMode: string | null;
  runtimeId: string;
  runtimeLabel: string;
  runtimeStatusLabel: string;
  runtimeStatusTone: ConsoleTone;
  runtimeType: string | null;
  statusDetail: string;
  statusLabel: string;
  statusTone: ConsoleTone;
};

export type ClusterNodesPageData = {
  errors: string[];
  nodes: ClusterNodeView[];
  offlineServers: OfflineServerView[];
  summary: {
    latestHeartbeatLabel: string;
    nodeCount: number;
    offlineCount: number;
    readyCount: number;
    workloadCount: number;
  };
};

const CLUSTER_READY_CONDITION = "Ready";
const CLUSTER_MEMORY_PRESSURE_CONDITION = "MemoryPressure";
const CLUSTER_DISK_PRESSURE_CONDITION = "DiskPressure";
const CLUSTER_PID_PRESSURE_CONDITION = "PIDPressure";

type Translator = ReturnType<typeof createTranslator>;

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

function formatRelativeTime(
  locale: Locale,
  t: Translator,
  value?: string | null,
) {
  return formatLocaleRelativeTime(locale, value, {
    justNowText: t("Just now"),
    notYetText: t("Not yet"),
  });
}

function formatExactTime(
  locale: Locale,
  t: Translator,
  value?: string | null,
) {
  return formatLocaleDateTime(locale, value, {
    emptyText: t("Not yet"),
  });
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

function humanizeLabel(
  value: string | null | undefined,
  t: Translator,
) {
  return t(humanize(value));
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
  locale: Locale,
  count: number,
  singular: string,
  plural: string,
  t: Translator,
) {
  return t(count === 1 ? singular : plural, {
    count: formatLocaleNumber(locale, count),
  });
}

function formatCompactNumber(
  locale: Locale,
  value: number,
  digits = 1,
) {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(1, digits),
  });

  return formatter.format(value);
}

function formatPercentLabel(
  locale: Locale,
  t: Translator,
  value?: number | null,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return t("No stats");
  }

  return `${formatCompactNumber(locale, value, 1)}%`;
}

function formatBytesLabel(
  locale: Locale,
  t: Translator,
  value?: number | null,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return t("No stats");
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
    return t(rounded === 1 ? "{count} byte" : "{count} bytes", {
      count: formatLocaleNumber(locale, rounded),
    });
  }

  return t(`{value} ${units[unitIndex]}`, {
    value: formatCompactNumber(locale, amount, digits),
  });
}

function formatCPUCapacityLabel(
  locale: Locale,
  t: Translator,
  value?: number | null,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return t("No stats");
  }

  if (Math.abs(value) >= 1000) {
    const cores = value / 1000;
    return t(cores === 1 ? "{count} core" : "{count} cores", {
      count: formatCompactNumber(locale, cores, 1),
    });
  }

  return t("{count} millicores", {
    count: formatLocaleNumber(locale, Math.round(value)),
  });
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
  t: Translator,
) {
  if (!ownerTenantId) {
    return t("Unknown owner");
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

function readResourceStatusKey(
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

function readConditionStatusKey(conditionID: string, status?: string | null) {
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

function isRuntimeOffline(runtime: FugueRuntime | null) {
  return runtime?.status?.trim().toLowerCase() === "offline";
}

function isWorkspaceOwnedOfflineRuntime(
  runtime: FugueRuntime | null,
  workspaceTenantId: string,
) {
  return (
    Boolean(runtime?.tenantId?.trim()) &&
    runtime?.tenantId?.trim() === workspaceTenantId &&
    isRuntimeOffline(runtime)
  );
}

function readRuntimeLabel(runtime: FugueRuntime, locale: Locale) {
  if (runtime.type === "managed-shared") {
    return readManagedSharedRuntimeLabel(runtime, locale);
  }

  return runtime.name ?? runtime.machineName ?? shortId(runtime.id);
}

function buildCPUResourceView(
  locale: Locale,
  t: Translator,
  stats: FugueClusterNodeCPUStats | null,
): ClusterNodeResourceView {
  const percent = stats?.usagePercent ?? null;
  const total =
    stats?.allocatableMilliCores ?? stats?.capacityMilliCores ?? null;

  return {
    detailLabel:
      stats?.capacityMilliCores !== null &&
      stats?.capacityMilliCores !== undefined
        ? t("{amount} capacity", {
            amount: formatCPUCapacityLabel(
              locale,
              t,
              stats.capacityMilliCores,
            ),
          })
        : t("Capacity unknown"),
    id: "cpu",
    label: t("Compute"),
    percentLabel: formatPercentLabel(locale, t, percent),
    percentValue: percent,
    statusLabel: t(readResourceStatusKey(percent)),
    statusTone: readResourceTone(percent),
    totalLabel:
      total !== null && total !== undefined
        ? t("{amount} allocatable", {
            amount: formatCPUCapacityLabel(locale, t, total),
          })
        : t("Allocatable unknown"),
    usageLabel: formatCPUCapacityLabel(locale, t, stats?.usedMilliCores),
  };
}

function buildMemoryResourceView(
  locale: Locale,
  t: Translator,
  stats: FugueClusterNodeMemoryStats | null,
  hasPressure: boolean,
): ClusterNodeResourceView {
  const percent = stats?.usagePercent ?? null;
  const total = stats?.allocatableBytes ?? stats?.capacityBytes ?? null;

  return {
    detailLabel:
      stats?.capacityBytes !== null && stats?.capacityBytes !== undefined
        ? t("{amount} capacity", {
            amount: formatBytesLabel(locale, t, stats.capacityBytes),
          })
        : t("Capacity unknown"),
    id: "memory",
    label: t("Memory"),
    percentLabel: formatPercentLabel(locale, t, percent),
    percentValue: percent,
    statusLabel: t(readResourceStatusKey(percent, hasPressure)),
    statusTone: readResourceTone(percent, hasPressure),
    totalLabel:
      total !== null && total !== undefined
        ? t("{amount} allocatable", {
            amount: formatBytesLabel(locale, t, total),
          })
        : t("Allocatable unknown"),
    usageLabel: formatBytesLabel(locale, t, stats?.usedBytes),
  };
}

function buildStorageResourceView(
  locale: Locale,
  t: Translator,
  stats: FugueClusterNodeStorageStats | null,
  hasPressure: boolean,
): ClusterNodeResourceView {
  const percent = stats?.usagePercent ?? null;
  const total = stats?.allocatableBytes ?? stats?.capacityBytes ?? null;

  return {
    detailLabel:
      stats?.capacityBytes !== null && stats?.capacityBytes !== undefined
        ? t("{amount} capacity", {
            amount: formatBytesLabel(locale, t, stats.capacityBytes),
          })
        : t("Capacity unknown"),
    id: "storage",
    label: t("Disk"),
    percentLabel: formatPercentLabel(locale, t, percent),
    percentValue: percent,
    statusLabel: t(readResourceStatusKey(percent, hasPressure)),
    statusTone: readResourceTone(percent, hasPressure),
    totalLabel:
      total !== null && total !== undefined
        ? t("{amount} allocatable", {
            amount: formatBytesLabel(locale, t, total),
          })
        : t("Allocatable unknown"),
    usageLabel: formatBytesLabel(locale, t, stats?.usedBytes),
  };
}

function buildClusterConditionViews(
  locale: Locale,
  t: Translator,
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
          ? t("Updated {time}", {
              time: formatRelativeTime(locale, t, transitionedAt),
            })
          : t("No signal reported")),
      id: definition.id,
      label: t(definition.label),
      lastTransitionExact: formatExactTime(locale, t, transitionedAt),
      lastTransitionLabel: formatRelativeTime(locale, t, transitionedAt),
      statusLabel: t(
        readConditionStatusKey(definition.id, condition?.status),
      ),
      tone: readConditionTone(definition.id, condition?.status),
    } satisfies ClusterNodeConditionView;
  });
}

function joinConditionLabels(locale: Locale, labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  try {
    return new Intl.ListFormat(locale, {
      style: "long",
      type: "conjunction",
    }).format(labels);
  } catch {
    return labels.join(", ");
  }
}

function buildClusterWorkloadViews(
  locale: Locale,
  t: Translator,
  workloads: FugueClusterNodeWorkload[],
) {
  return workloads.map((workload) => {
    const podCount = workload.podCount || workload.pods.length;
    const kindLabel =
      workload.kind === "backing_service"
        ? workload.serviceType
          ? humanizeLabel(workload.serviceType, t)
          : t("Service")
        : t("App");
    const metaParts = [
      formatCountLabel(locale, podCount, "{count} pod", "{count} pods", t),
      workload.namespace?.trim() || null,
    ].filter((value): value is string => Boolean(value));
    const podLabel = workload.pods.length
      ? workload.pods
          .map((pod) =>
            pod.phase?.trim()
              ? t("{name} ({phase})", {
                  name: pod.name,
                  phase: humanizeLabel(pod.phase, t),
                })
              : pod.name,
          )
          .join(" / ")
      : t("No active pods reported");

    return {
      id: workload.id,
      kindLabel,
      kindTone: workload.kind === "backing_service" ? "neutral" : "info",
      metaLabel: metaParts.join(" / ") || t("Waiting for workload details"),
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
  locale: Locale,
  nodes: FugueClusterNode[],
  runtimes: FugueRuntime[],
  workspaceTenantId: string,
  ownerEmailByTenantId: Map<string, string>,
) {
  const t = createTranslator(locale);
  const runtimeById = new Map(
    runtimes.map((runtime) => [runtime.id, runtime] as const),
  );
  const runtimeByNodeName = new Map(
    runtimes
      .filter((runtime) => runtime.clusterNodeName)
      .map((runtime) => [runtime.clusterNodeName as string, runtime] as const),
  );
  const visibleNodes = nodes.filter((node) => {
    const runtime = resolveRuntimeForNode(node, runtimeById, runtimeByNodeName);

    return !isWorkspaceOwnedOfflineRuntime(runtime, workspaceTenantId);
  });

  const views = visibleNodes.map((node) => {
    const runtime = resolveRuntimeForNode(node, runtimeById, runtimeByNodeName);
    const ownership = readRuntimeOwnership(node, runtime, workspaceTenantId);
    const ownerTenantId = readOwnerTenantId(node, runtime);
    const ownerLabel = readOwnerLabel(ownerTenantId, ownerEmailByTenantId, t);
    const ownerEmail = ownerTenantId
      ? (ownerEmailByTenantId.get(ownerTenantId) ?? null)
      : null;
    const conditionViews = buildClusterConditionViews(locale, t, node);
    const memoryPressure = isConditionActive(
      node.conditions[CLUSTER_MEMORY_PRESSURE_CONDITION]?.status,
    );
    const diskPressure = isConditionActive(
      node.conditions[CLUSTER_DISK_PRESSURE_CONDITION]?.status,
    );
    const pressureSignals = conditionViews.filter(
      (condition) =>
        condition.id !== CLUSTER_READY_CONDITION && condition.tone === "danger",
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
        ? t("Not ready")
        : pressureSignals.length
          ? t("Pressure")
          : node.status?.trim().toLowerCase() === "ready"
            ? t("Ready")
            : humanizeLabel(node.status, t);
    const statusTone =
      node.status?.trim().toLowerCase() === "not-ready"
        ? "danger"
        : pressureSignals.length
          ? "warning"
          : node.status?.trim().toLowerCase() === "ready"
            ? "positive"
            : toneForStatus(node.status);
    const location = readCountryLocation(node.region, node.zone, locale);
    const locationLabel = location.locationLabel;
    const heartbeatAt = runtime?.lastHeartbeatAt ?? runtime?.lastSeenAt ?? null;
    const isPublicRuntime =
      runtime?.accessMode?.trim().toLowerCase() === "public";
    const publicOfferDescription = isPublicRuntime
      ? readRuntimePublicOfferDescription(runtime?.publicOffer, locale)
      : null;
    const ownershipLabel =
      ownership === "shared"
        ? isPublicRuntime
          ? ownerEmail
            ? t("Public by {label}", { label: ownerEmail })
            : t("Public server")
          : ownerEmail
            ? t("Shared by {label}", { label: ownerEmail })
            : t("Shared with this workspace")
        : ownership === "internal-cluster"
          ? t("Internal cluster capacity")
          : isPublicRuntime
            ? t("Public access enabled")
            : runtime?.poolMode?.trim().toLowerCase() === "internal-shared"
              ? t("Internal cluster enabled")
              : null;
    const statusFragments = [
      locationLabel !== t("Unassigned") ? locationLabel : null,
      heartbeatAt
        ? t("Heartbeat {time}", {
            time: formatRelativeTime(locale, t, heartbeatAt),
          })
        : t("Waiting for first heartbeat"),
      ownershipLabel,
      formatCountLabel(
        locale,
        workloadCount,
        "{count} workload",
        "{count} workloads",
        t,
      ),
    ].filter((value): value is string => Boolean(value));
    const ownershipDetail =
      ownership === "shared"
        ? isPublicRuntime
          ? ownerEmail
            ? t("Public by {label}. {details}", {
                details: publicOfferDescription ?? "",
                label: ownerEmail,
              })
            : publicOfferDescription
          : ownerEmail
            ? t("Shared by {label}.", { label: ownerEmail })
            : t("Shared with your workspace.")
        : ownership === "internal-cluster"
          ? t("Part of Fugue shared capacity.")
          : isPublicRuntime
            ? t("Any workspace can deploy here. {details}", {
                details: publicOfferDescription ?? "",
              })
            : runtime?.poolMode?.trim().toLowerCase() === "internal-shared"
              ? t("Internal cluster can also deploy here.")
              : null;

    return {
      accessMode: runtime?.accessMode ?? null,
      appCount,
      canManageSharing: ownership === "owned" && Boolean(runtime?.id),
      conditions: conditionViews,
      createdExact: formatExactTime(locale, t, node.createdAt),
      createdLabel: formatRelativeTime(locale, t, node.createdAt),
      headerMeta: statusFragments.join(" · "),
      heartbeatExact: formatExactTime(locale, t, heartbeatAt),
      heartbeatLabel: formatRelativeTime(locale, t, heartbeatAt),
      internalIpLabel: node.internalIp?.trim() || t("Unavailable"),
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
      publicIpLabel: node.publicIp?.trim() || t("Unavailable"),
      roleLabels: node.roles.length ? node.roles : [],
      resources: [
        buildCPUResourceView(locale, t, node.cpu),
        buildMemoryResourceView(locale, t, node.memory, memoryPressure),
        buildStorageResourceView(locale, t, node.ephemeralStorage, diskPressure),
      ],
      runtimeId: runtime?.id ?? node.runtimeId ?? null,
      runtimeLabel: runtime
        ? readRuntimeLabel(runtime, locale)
        : node.runtimeId
          ? shortId(node.runtimeId)
          : t("Awaiting runtime"),
      runtimeStatusLabel: runtime
        ? humanizeLabel(runtime.status, t)
        : t("Awaiting runtime"),
      runtimeStatusTone: runtime ? toneForStatus(runtime.status) : "neutral",
      runtimeType: runtime?.type ?? null,
      serviceCount,
      statusDetail:
        pressureSignals.length > 0
          ? t("{signals} pressure reported.", {
              signals: joinConditionLabels(
                locale,
                pressureSignals.map((condition) => condition.label),
              ),
            })
          : node.status?.trim().toLowerCase() === "ready"
            ? ownershipDetail
            : t("Waiting for complete node health telemetry."),
      statusLabel,
      statusTone,
      workloadCount,
      workloads: buildClusterWorkloadViews(locale, t, node.workloads),
      zoneLabel: node.zone?.trim() || t("Unassigned"),
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

function buildOfflineServerViews(
  locale: Locale,
  nodes: FugueClusterNode[],
  runtimes: FugueRuntime[],
  workspaceTenantId: string,
) {
  const t = createTranslator(locale);
  const runtimeById = new Map(
    runtimes.map((runtime) => [runtime.id, runtime] as const),
  );
  const runtimeByNodeName = new Map(
    runtimes
      .filter((runtime) => runtime.clusterNodeName)
      .map((runtime) => [runtime.clusterNodeName as string, runtime] as const),
  );
  const attachedRuntimeIDs = new Set<string>();

  for (const node of nodes) {
    const runtime = resolveRuntimeForNode(node, runtimeById, runtimeByNodeName);

    if (
      runtime?.id &&
      !isWorkspaceOwnedOfflineRuntime(runtime, workspaceTenantId)
    ) {
      attachedRuntimeIDs.add(runtime.id);
    }
  }

  const offlineOwnedRuntimes = runtimes
    .filter((runtime) => runtime.tenantId?.trim() === workspaceTenantId)
    .filter(
      (runtime) => runtime.type?.trim().toLowerCase() !== "managed-shared",
    )
    .filter((runtime) => runtime.status?.trim().toLowerCase() === "offline")
    .filter((runtime) => !attachedRuntimeIDs.has(runtime.id))
    .sort((left, right) => {
      const leftTimestamp = readRuntimeTimestamp(left);
      const rightTimestamp = readRuntimeTimestamp(right);

      if (leftTimestamp !== rightTimestamp) {
        return leftTimestamp - rightTimestamp;
      }

      return readRuntimeLabel(left, locale).localeCompare(
        readRuntimeLabel(right, locale),
      );
    });

  const latestHeartbeatTimestamp = offlineOwnedRuntimes.reduce(
    (latest, runtime) => Math.max(latest, readRuntimeTimestamp(runtime)),
    0,
  );

  return {
    latestHeartbeatAt: latestHeartbeatTimestamp
      ? new Date(latestHeartbeatTimestamp).toISOString()
      : null,
    views: offlineOwnedRuntimes.map((runtime) => {
      const location = readRuntimeLocation(runtime.labels, locale);
      const lastContactAt =
        runtime.lastHeartbeatAt ??
        runtime.lastSeenAt ??
        runtime.updatedAt ??
        runtime.createdAt ??
        null;
      const publicAccessEnabled =
        runtime.accessMode?.trim().toLowerCase() === "public";
      const publicOfferDescription = publicAccessEnabled
        ? readRuntimePublicOfferDescription(runtime.publicOffer, locale)
        : null;
      const statusFragments = [
        location.locationLabel ?? null,
        lastContactAt
          ? t("Last contact {time}", {
              time: formatRelativeTime(locale, t, lastContactAt),
            })
          : t("No contact recorded"),
        publicAccessEnabled
          ? t("Public access")
          : runtime.poolMode?.trim().toLowerCase() === "internal-shared"
            ? t("Internal cluster enabled")
            : null,
      ].filter((value): value is string => Boolean(value));
      const clusterNodeName = runtime.clusterNodeName?.trim();

      return {
        accessMode: runtime.accessMode ?? null,
        clusterNodeNameLabel: clusterNodeName || t("Not assigned"),
        connectionLabel: humanizeLabel(runtime.connectionMode, t),
        createdExact: formatExactTime(locale, t, runtime.createdAt),
        createdLabel: formatRelativeTime(locale, t, runtime.createdAt),
        endpointLabel: runtime.endpoint?.trim() || t("Unavailable"),
        headerMeta: statusFragments.join(" · "),
        lastContactExact: formatExactTime(locale, t, lastContactAt),
        lastContactLabel: formatRelativeTime(locale, t, lastContactAt),
        locationCountryCode: location.locationCountryCode,
        locationLabel: location.locationLabel ?? t("Unassigned"),
        machineLabel:
          runtime.machineName?.trim() ||
          clusterNodeName ||
          runtime.name?.trim() ||
          shortId(runtime.id),
        name:
          runtime.name?.trim() ||
          runtime.machineName?.trim() ||
          clusterNodeName ||
          shortId(runtime.id),
        poolMode: runtime.poolMode ?? null,
        runtimeId: runtime.id,
        runtimeLabel: readRuntimeLabel(runtime, locale),
        runtimeStatusLabel: humanizeLabel(runtime.status, t),
        runtimeStatusTone:
          runtime.status?.trim().toLowerCase() === "offline"
            ? "warning"
            : toneForStatus(runtime.status),
        runtimeType: runtime.type ?? null,
        statusDetail: clusterNodeName
          ? t("{name} is no longer reporting heartbeats.", {
              name: clusterNodeName,
            })
          : publicOfferDescription
            ? t("This server is offline. {details}", {
                details: publicOfferDescription,
              })
            : t("This server is offline and no longer reporting heartbeats."),
        statusLabel: t("Offline"),
        statusTone: "warning",
      } satisfies OfflineServerView;
    }),
  };
}

export async function getClusterNodesPageData(
  email: string,
  locale: Locale = "en",
): Promise<ClusterNodesPageData | null> {
  const t = createTranslator(locale);
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
    errors.push(
      t("Cluster nodes: {message}", {
        message: readErrorMessage(nodesResult.reason),
      }),
    );
  }

  if (runtimesResult.status === "rejected") {
    errors.push(
      t("Runtimes: {message}", {
        message: readErrorMessage(runtimesResult.reason),
      }),
    );
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

  if (ownerTenantIds.size) {
    try {
      const ownerSnapshots = await getWorkspaceSnapshotsByTenantIds([
        ...ownerTenantIds,
      ]);

      for (const snapshot of ownerSnapshots) {
        if (!snapshot.email) {
          continue;
        }

        ownerEmailByTenantId.set(snapshot.tenantId, snapshot.email);
      }
    } catch (error) {
      errors.push(
        t("Workspace owners: {message}", {
          message: readErrorMessage(error),
        }),
      );
    }
  }

  const built = buildClusterNodeViews(
    locale,
    nodes,
    runtimes,
    workspace.tenantId,
    ownerEmailByTenantId,
  );
  const offlineBuilt = buildOfflineServerViews(
    locale,
    nodes,
    runtimes,
    workspace.tenantId,
  );
  const readyCount = built.views.filter(
    (node) => node.statusTone === "positive",
  ).length;
  const workloadCount = built.views.reduce(
    (total, node) => total + node.workloadCount,
    0,
  );
  const latestHeartbeatTimestamp = Math.max(
    parseTimestamp(built.latestHeartbeatAt),
    parseTimestamp(offlineBuilt.latestHeartbeatAt),
  );
  const latestHeartbeatAt = latestHeartbeatTimestamp
    ? new Date(latestHeartbeatTimestamp).toISOString()
    : null;

  return {
    errors,
    nodes: built.views,
    offlineServers: offlineBuilt.views,
    summary: {
      latestHeartbeatLabel: formatRelativeTime(locale, t, latestHeartbeatAt),
      nodeCount: built.views.length + offlineBuilt.views.length,
      offlineCount: offlineBuilt.views.length,
      readyCount,
      workloadCount,
    },
  } satisfies ClusterNodesPageData;
}
