import { AdminAppManager } from "@/components/admin/admin-app-manager";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelSection } from "@/components/ui/panel";
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
        description="Cluster-wide apps, rebuilds, and deletes."
        eyebrow="Admin / apps"
        title="Cluster apps"
      />

      <AdminSummaryGrid
        items={[
          { label: "apps", value: data.summary.appCount },
          { label: "routed", value: data.summary.routedCount },
          { label: "tenants", value: data.summary.tenantCount },
          { label: "last update", value: data.summary.latestUpdateLabel },
        ]}
      />

      <Panel>
        <PanelSection>
          <AdminAppManager apps={data.apps} />
        </PanelSection>
      </Panel>
    </div>
  );
}
