import { ClusterNodeGallery, type ClusterNodeGalleryItem } from "@/components/console/cluster-node-gallery";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { Panel, PanelSection } from "@/components/ui/panel";
import type { ClusterNodeView } from "@/lib/cluster-nodes/service";

function readModeLabel(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function readInternalClusterAccessLabel(value?: string | null) {
  return value?.trim().toLowerCase() === "internal-shared" ? "Enabled" : "Dedicated only";
}

function toClusterGalleryItem(
  node: ClusterNodeView,
  options: {
    isAdmin: boolean;
  },
): ClusterNodeGalleryItem {
  const facts: ClusterNodeGalleryItem["facts"] = [
    {
      id: "machine",
      label: "Machine",
      value: node.machineLabel,
    },
    {
      id: "public-address",
      label: "Public address",
      value: node.publicIpLabel,
    },
    {
      id: "internal-address",
      label: "Internal address",
      value: node.internalIpLabel,
    },
    {
      countryCode: node.locationCountryCode,
      id: "location",
      label: "Location",
      value: node.locationLabel,
    },
    {
      id: "runtime",
      label: "Runtime",
      value: node.runtimeLabel,
    },
    {
      id: "runtime-state",
      label: "Runtime state",
      value: node.runtimeStatusLabel,
      valueTone: node.runtimeStatusTone,
    },
  ];

  if (node.ownership === "shared" && (node.ownerEmail || node.ownerLabel)) {
    facts.push({
      id: "owner",
      label: "Owner",
      value: node.ownerEmail ?? node.ownerLabel,
    });
  }

  if (node.accessMode && node.accessMode !== "private") {
    facts.push({
      id: "visibility",
      label: "Visibility",
      value: readModeLabel(node.accessMode),
    });
  }

  if (node.poolMode && node.runtimeType?.trim().toLowerCase() === "managed-owned") {
    facts.push({
      id: "internal-cluster",
      label: "Internal cluster",
      value: readInternalClusterAccessLabel(node.poolMode),
    });
  }

  facts.push(
    {
      id: "heartbeat",
      label: "Heartbeat",
      title: node.heartbeatExact,
      value: node.heartbeatLabel,
    },
    {
      id: "zone",
      label: "Zone",
      value: node.zoneLabel,
    },
    {
      id: "joined",
      label: "Joined",
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
        ? "Attached server"
        : node.ownership === "internal-cluster"
          ? "Cluster capacity"
          : "Shared server",
    facts,
    headerMeta: node.headerMeta,
    id: node.name,
    name: node.name,
    ownerEmail: node.ownerEmail,
    ownerLabel: node.ownerLabel,
    ownership: node.ownership,
    poolMode: node.poolMode,
    resources: node.resources,
    roleLabels: node.roleLabels,
    runtimeId: node.runtimeId,
    serviceCount: node.serviceCount,
    statusDetail: node.statusDetail,
    statusLabel: node.statusLabel,
    statusTone: node.statusTone,
    runtimeType: node.runtimeType,
    workloadCount: node.workloadCount,
    workloadEmptyDescription: "No apps or services are placed on this server.",
    workloadEmptyTitle: "No workloads on this server",
    workloadSectionNote: "Apps and services on this server.",
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
  if (!nodes.length) {
    return (
      <Panel>
        <PanelSection>
          <ConsoleEmptyState
            action={
              inventoryError
                ? { href: "/app/api-keys", label: "Manage access keys" }
                : { href: "/app/api-keys#node-keys", label: "Open node keys" }
            }
            description={
              inventoryError
                ? inventoryError
                : "Create a node key, run the join command on your VPS, or wait for another workspace to share a server with you."
            }
            title={inventoryError ? "Server inventory unavailable" : "No servers visible yet"}
          />
        </PanelSection>
      </Panel>
    );
  }

  return (
    <ClusterNodeGallery
      ariaLabel="Servers"
      items={nodes.map((node) => toClusterGalleryItem(node, { isAdmin }))}
    />
  );
}
