"use client";

import {
  ClusterNodeGallery,
  type ClusterNodeGalleryItem,
} from "@/components/console/cluster-node-gallery";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { Panel, PanelSection } from "@/components/ui/panel";
import type { AdminClusterNodeView } from "@/lib/admin/service";
import type { ConsoleTone } from "@/lib/console/types";

function readOnOffTone(enabled: boolean): ConsoleTone {
  return enabled ? "positive" : "neutral";
}

function readDedicatedModeTone(value?: string | null): ConsoleTone {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "neutral";
  }

  switch (normalized) {
    case "edge":
    case "dns":
    case "internal":
      return "info";
    case "none":
      return "neutral";
    default:
      return "warning";
  }
}

function readPolicyModeLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "Unknown";
  }

  switch (normalized) {
    case "dns":
      return "DNS";
    case "edge":
      return "Edge";
    case "internal":
      return "Internal";
    case "none":
      return "None";
    default:
      return normalized
        .replace(/[._-]+/g, " ")
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase());
  }
}

export function buildAdminClusterGalleryItem(
  node: AdminClusterNodeView,
): ClusterNodeGalleryItem {
  return {
    appCount: node.appCount,
    conditions: node.conditions,
    eyebrow: "Cluster node",
    facts: [
      {
        countryCode: node.locationCountryCode,
        id: "location",
        label: "Location",
        value: node.locationLabel,
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
        id: "zone",
        label: "Zone",
        value: node.zoneLabel,
      },
      {
        id: "edge-policy",
        label: "Edge",
        translateValue: true,
        value: node.policy?.effectiveEdge ? "On" : "Off",
        valueTone: readOnOffTone(node.policy?.effectiveEdge ?? false),
      },
      {
        id: "dns-policy",
        label: "DNS",
        translateValue: true,
        value: node.policy?.effectiveDns ? "On" : "Off",
        valueTone: readOnOffTone(node.policy?.effectiveDns ?? false),
      },
      {
        id: "dedicated-mode",
        label: "Placement",
        translateValue: true,
        value: readPolicyModeLabel(node.policy?.effectiveDedicatedMode),
        valueTone: readDedicatedModeTone(node.policy?.effectiveDedicatedMode),
      },
      {
        id: "schedulable",
        label: "Schedulable",
        translateValue: true,
        value: node.policy?.effectiveSchedulable ? "On" : "Off",
        valueTone: readOnOffTone(node.policy?.effectiveSchedulable ?? false),
      },
      {
        id: "runtime",
        label: "Runtime",
        value: node.runtimeLabel,
      },
      {
        id: "tenant",
        label: "Tenant",
        value: node.tenantLabel,
      },
      {
        id: "machine-scope",
        label: "Machine scope",
        translateValue: true,
        value: node.machine?.scopeLabel ?? "Unmanaged",
      },
      {
        id: "connection",
        label: "Connection",
        translateValue: true,
        value: node.machine?.connectionModeLabel ?? "Unavailable",
      },
      {
        id: "node-key",
        label: "Node key",
        title: node.machine?.nodeKeyId ?? node.machine?.nodeKeyLabel,
        value: node.machine?.nodeKeyLabel ?? "Unavailable",
      },
      {
        id: "created",
        label: "Created",
        title: node.createdExact,
        value: node.createdLabel,
      },
    ],
    headerMeta: node.headerMeta,
    id: node.name,
    name: node.name,
    resources: node.resources,
    roleLabels: node.roleLabels,
    serviceCount: node.serviceCount,
    statusDetail: node.statusDetail,
    statusLabel: node.statusLabel,
    statusTone: node.statusTone,
    workloadCount: node.workloadCount,
    workloadEmptyDescription:
      "No Fugue app or backing service is currently scheduled onto this node.",
    workloadEmptyTitle: "No workloads on this node",
    workloadSectionNote: "Fugue apps and backing services placed on this machine.",
    workloads: node.workloads,
  };
}

export function AdminClusterOverview({
  nodes,
}: {
  nodes: AdminClusterNodeView[];
}) {
  const { t } = useI18n();

  if (!nodes.length) {
    return (
      <Panel>
        <PanelSection>
          <ConsoleEmptyState
            description={t("No cluster nodes are visible from the current bootstrap scope.")}
            title={t("No cluster nodes visible")}
          />
        </PanelSection>
      </Panel>
    );
  }

  return (
    <ClusterNodeGallery
      ariaLabel={t("Cluster nodes")}
      items={nodes.map(buildAdminClusterGalleryItem)}
    />
  );
}
