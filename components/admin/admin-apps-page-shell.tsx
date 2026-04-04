"use client";

import { AdminAppManager } from "@/components/admin/admin-app-manager";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import {
  ConsoleAdminAppsPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import {
  CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL,
  type ConsoleAdminAppsPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

export function AdminAppsPageShell() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminAppsPageSnapshot>(
      CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL,
    );

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleAdminAppsPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          description="Cluster-wide apps with current CPU, memory, and disk samples."
          eyebrow="Admin / Apps"
          title="Cluster apps"
        />

        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? "Fugue could not load the admin apps snapshot right now."}
              title="Cluster apps unavailable"
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = data.errors.length
    ? `Partial admin data: ${data.errors.join(" | ")}.`
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsolePageIntro
        description="Cluster-wide apps with current CPU, memory, and disk samples."
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
          <AdminAppManager
            apps={data.apps}
            onRefresh={() => {
              void refresh({ force: true });
            }}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
