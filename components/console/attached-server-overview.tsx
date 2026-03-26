import { ClusterNodeGallery, type ClusterNodeGalleryItem } from "@/components/console/cluster-node-gallery";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { Panel, PanelSection } from "@/components/ui/panel";
import type { ClusterNodeView } from "@/lib/cluster-nodes/service";

function toClusterGalleryItem(node: ClusterNodeView): ClusterNodeGalleryItem {
  return {
    appCount: node.appCount,
    conditions: node.conditions,
    eyebrow: "Attached server",
    facts: [
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
      "No app or backing service is currently scheduled onto this server.",
    workloadEmptyTitle: "No workloads on this server",
    workloadSectionNote: "Apps and backing services currently placed on this server.",
    workloads: node.workloads,
  };
}

export function AttachedServerOverview({
  inventoryError,
  nodes,
}: {
  inventoryError?: string | null;
  nodes: ClusterNodeView[];
}) {
  if (!nodes.length) {
    return (
      <Panel>
        <PanelSection>
          <ConsoleEmptyState
            action={
              inventoryError
                ? { href: "/app/runtimes", label: "Open runtimes" }
                : { href: "/app/api-keys#node-keys", label: "Open node keys" }
            }
            description={
              inventoryError
                ? inventoryError
                : "Copy a cluster join command from Access keys, run it on your VPS, and the server will appear here after its first heartbeat."
            }
            title={inventoryError ? "Cluster node inventory unavailable" : "No servers attached yet"}
          />
        </PanelSection>
      </Panel>
    );
  }

  return (
    <ClusterNodeGallery
      ariaLabel="Attached servers"
      items={nodes.map(toClusterGalleryItem)}
    />
  );
}
