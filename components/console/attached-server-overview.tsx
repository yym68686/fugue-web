import {
  ClusterNodeGallery,
  type ClusterNodeGalleryItem,
} from "@/components/console/cluster-node-gallery";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { Panel, PanelSection } from "@/components/ui/panel";
import type { ClusterNodeView } from "@/lib/cluster-nodes/service";
import { readRuntimePublicOfferSummary } from "@/lib/runtimes/public-offer";

function readModeLabel(
  value: string | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (!value) {
    return t("Unknown");
  }

  return t(
    value
      .replace(/[._-]+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase()),
  );
}

function readInternalClusterAccessLabel(
  value: string | null | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return value?.trim().toLowerCase() === "internal-shared"
    ? t("Enabled")
    : t("Dedicated only");
}

function toClusterGalleryItem(
  node: ClusterNodeView,
  options: {
    isAdmin: boolean;
    t: (key: string, values?: Record<string, string | number>) => string;
  },
): ClusterNodeGalleryItem {
  const { t } = options;
  const facts: ClusterNodeGalleryItem["facts"] = [
    {
      id: "machine",
      label: t("Machine"),
      value: node.machineLabel,
    },
    {
      id: "public-address",
      label: t("Public address"),
      value: node.publicIpLabel,
    },
    {
      id: "internal-address",
      label: t("Internal address"),
      value: node.internalIpLabel,
    },
    {
      countryCode: node.locationCountryCode,
      id: "location",
      label: t("Location"),
      value: node.locationLabel,
    },
    {
      id: "runtime",
      label: t("Runtime"),
      value: node.runtimeLabel,
    },
    {
      id: "runtime-state",
      label: t("Runtime state"),
      value: node.runtimeStatusLabel,
      valueTone: node.runtimeStatusTone,
    },
  ];

  if (node.ownership === "shared" && (node.ownerEmail || node.ownerLabel)) {
    facts.push({
      id: "owner",
      label: t("Owner"),
      value: node.ownerEmail ?? node.ownerLabel,
    });
  }

  if (node.accessMode && node.accessMode !== "private") {
    facts.push({
      id: "visibility",
      label: t("Visibility"),
      value: readModeLabel(node.accessMode, t),
    });
  }

  if (node.accessMode === "public") {
    facts.push({
      id: "public-pricing",
      label: t("Public pricing"),
      value: readRuntimePublicOfferSummary(node.publicOffer),
    });
  }

  if (
    node.poolMode &&
    node.runtimeType?.trim().toLowerCase() === "managed-owned"
  ) {
    facts.push({
      id: "internal-cluster",
      label: t("Internal cluster"),
      value: readInternalClusterAccessLabel(node.poolMode, t),
    });
  }

  facts.push(
    {
      id: "heartbeat",
      label: t("Heartbeat"),
      title: node.heartbeatExact,
      value: node.heartbeatLabel,
    },
    {
      id: "zone",
      label: t("Zone"),
      value: node.zoneLabel,
    },
    {
      id: "joined",
      label: t("Joined"),
      title: node.createdExact,
      value: node.createdLabel,
    },
  );

  return {
    accessMode: node.accessMode,
    appCount: node.appCount,
    canManagePool:
      options.isAdmin &&
      node.ownership === "owned" &&
      node.runtimeType?.trim().toLowerCase() === "managed-owned",
    canManageSharing: node.canManageSharing,
    conditions: node.conditions,
    eyebrow:
      node.ownership === "owned"
        ? t("Attached server")
        : node.ownership === "internal-cluster"
          ? t("Cluster capacity")
          : node.accessMode === "public"
            ? t("Public server")
            : t("Shared server"),
    facts,
    headerMeta: node.headerMeta,
    id: node.name,
    name: node.name,
    ownerEmail: node.ownerEmail,
    ownerLabel: node.ownerLabel,
    ownership: node.ownership,
    poolMode: node.poolMode,
    publicOffer: node.publicOffer,
    resources: node.resources,
    roleLabels: node.roleLabels,
    runtimeId: node.runtimeId,
    serviceCount: node.serviceCount,
    statusDetail: node.statusDetail,
    statusLabel: node.statusLabel,
    statusTone: node.statusTone,
    runtimeType: node.runtimeType,
    workloadCount: node.workloadCount,
    workloadEmptyDescription: t(
      "No apps or services are placed on this server.",
    ),
    workloadEmptyTitle: t("No workloads on this server"),
    workloadSectionNote: t("Apps and services on this server."),
    workloads: node.workloads,
  };
}

export function AttachedServerOverview({
  inventoryError,
  isAdmin = false,
  nodes,
}: {
  inventoryError?: string | null;
  isAdmin?: boolean;
  nodes: ClusterNodeView[];
}) {
  const { t } = useI18n();

  if (!nodes.length) {
    return (
      <Panel>
        <PanelSection>
          <ConsoleEmptyState
            action={
              inventoryError
                ? { href: "/app/api-keys", label: t("Manage access keys") }
                : {
                    href: "/app/api-keys#node-keys",
                    label: t("Open node keys"),
                  }
            }
            description={
              inventoryError
                ? inventoryError
                : t(
                    "Create a node key, run the join command on your VPS, or wait for another workspace to share a server with you.",
                  )
            }
            title={
              inventoryError
                ? t("Server inventory unavailable")
                : t("No servers visible yet")
            }
          />
        </PanelSection>
      </Panel>
    );
  }

  return (
    <ClusterNodeGallery
      ariaLabel={t("Servers")}
      items={nodes.map((node) => toClusterGalleryItem(node, { isAdmin, t }))}
    />
  );
}
