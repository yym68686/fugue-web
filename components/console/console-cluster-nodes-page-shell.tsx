"use client";

import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
import { AttachedServerOverview } from "@/components/console/attached-server-overview";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import {
  ConsoleClusterNodesPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { ConsoleSummaryGrid } from "@/components/console/console-summary-grid";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import {
  CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL,
  type ConsoleClusterNodesPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

export function ConsoleClusterNodesPageShell() {
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleClusterNodesPageSnapshot>(
      CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL,
    );

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleClusterNodesPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? "Fugue could not load the server inventory right now."}
              title="Server inventory unavailable"
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  if (data.state === "workspace-missing") {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ApiKeyEmptyState />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = data.data.errors.length
    ? `Partial server data: ${data.data.errors.join(" | ")}.`
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsoleSummaryGrid
        ariaLabel="Server summary"
        items={[
          { label: "Servers", value: data.data.summary.nodeCount },
          { label: "Ready", value: data.data.summary.readyCount },
          { label: "Workloads", value: data.data.summary.workloadCount },
          { label: "Latest heartbeat", value: data.data.summary.latestHeartbeatLabel },
        ]}
      />

      <div className="fg-credential-section__head">
        <div className="fg-credential-section__copy">
          <strong>Server inventory</strong>
          <p>Expand a server for access, capacity, and placement.</p>
        </div>
      </div>

      <AttachedServerOverview
        inventoryError={errorMessage}
        isAdmin={data.isAdmin}
        nodes={data.data.nodes}
      />
    </div>
  );
}
