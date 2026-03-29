import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
import { AttachedServerOverview } from "@/components/console/attached-server-overview";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { ConsoleSummaryGrid } from "@/components/console/console-summary-grid";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import { getCurrentSession } from "@/lib/auth/session";
import { getClusterNodesPageData } from "@/lib/cluster-nodes/service";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";
import { ensureAppUser } from "@/lib/workspace/store";

export default async function ClusterNodesPage() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const user = await ensureAppUser(session);

  try {
    await ensureWorkspaceAccess(session);
  } catch {
    // Fall through to the manual recovery state.
  }

  const data = await getClusterNodesPageData(session.email);

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          description="Attach a server, or use a server shared with your workspace, then confirm heartbeat and placement here."
          eyebrow="Servers"
          title="Servers"
        />

        <Panel>
          <PanelSection>
            <ApiKeyEmptyState />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = data.errors.length
    ? `Partial server data: ${data.errors.join(" | ")}.`
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsolePageIntro
        description="Health, sharing, and placement for servers visible to this workspace."
        eyebrow="Servers"
        title="Servers"
      />

      <ConsoleSummaryGrid
        ariaLabel="Server summary"
        items={[
          { label: "Servers", value: data.summary.nodeCount },
          { label: "Ready", value: data.summary.readyCount },
          { label: "Workloads", value: data.summary.workloadCount },
          { label: "Latest heartbeat", value: data.summary.latestHeartbeatLabel },
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
        isAdmin={user.isAdmin}
        nodes={data.nodes}
      />
    </div>
  );
}
