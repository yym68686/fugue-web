import { AdminAppManager } from "@/components/admin/admin-app-manager";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminAppsPageData } from "@/lib/admin/service";

export default async function AppsPage() {
  await requireAdminPageAccess();
  const data = await getAdminAppsPageData();

  return (
    <div className="fg-console-page">
      {data.errors.length ? (
        <InlineAlert variant="error">
          Partial admin data: {data.errors.join(" | ")}.
        </InlineAlert>
      ) : null}

      <ConsolePageIntro
        description="Cluster-wide app inventory from the bootstrap admin surface. Rebuild and delete land here first."
        eyebrow="Admin / apps"
        title="Cluster apps"
      />

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Cluster inventory</p>
            <PanelTitle>All visible apps</PanelTitle>
            <PanelCopy>Everything currently visible through the bootstrap admin key.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <AdminAppManager apps={data.apps} />
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Readout</p>
            <PanelTitle>Cluster summary</PanelTitle>
            <PanelCopy>Fast counts for the current app surface.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <ul className="fg-console-stat-list">
              <li>
                <strong>Total apps</strong>
                <span>{data.summary.appCount}</span>
              </li>
              <li>
                <strong>Routed apps</strong>
                <span>{data.summary.routedCount}</span>
              </li>
              <li>
                <strong>Tenants</strong>
                <span>{data.summary.tenantCount}</span>
              </li>
              <li>
                <strong>Latest update</strong>
                <span>{data.summary.latestUpdateLabel}</span>
              </li>
            </ul>
          </PanelSection>
        </Panel>
      </section>
    </div>
  );
}
