import {
  ClusterNodeGallery,
  type ClusterNodeGalleryItem,
} from "@/components/console/cluster-node-gallery";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { Panel, PanelSection } from "@/components/ui/panel";
import type { AdminClusterNodeView } from "@/lib/admin/service";

function toClusterGalleryItem(node: AdminClusterNodeView): ClusterNodeGalleryItem {
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
  if (!nodes.length) {
    return (
      <Panel>
        <PanelSection>
          <ConsoleEmptyState
            description="No cluster nodes are visible from the current bootstrap scope."
            title="No cluster nodes visible"
          />
        </PanelSection>
      </Panel>
    );
  }

  return (
    <ClusterNodeGallery
      ariaLabel="Cluster nodes"
      items={nodes.map(toClusterGalleryItem)}
    />
  );
}
