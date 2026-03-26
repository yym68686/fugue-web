import { AdminAppManager } from "@/components/admin/admin-app-manager";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminAppsPageData } from "@/lib/admin/service";

export default async function AppsPage() {
  await requireAdminPageAccess();
  const data = await getAdminAppsPageData();
  const errorMessage = data.errors.length
    ? `Partial admin data: ${data.errors.join(" | ")}.`
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsolePageIntro
        description="Cluster-wide apps."
        eyebrow="Admin / Apps"
        title="Cluster apps"
      />

      <AdminSummaryGrid
        items={[
          { label: "Apps", value: data.summary.appCount },
          { label: "Routed", value: data.summary.routedCount },
          { label: "Tenants", value: data.summary.tenantCount },
          { label: "Last update", value: data.summary.latestUpdateLabel },
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
