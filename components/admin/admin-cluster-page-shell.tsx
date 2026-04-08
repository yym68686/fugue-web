"use client";

import { AdminControlPlanePanel } from "@/components/admin/admin-control-plane-panel";
import { AdminClusterOverview } from "@/components/admin/admin-cluster-overview";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ConsoleAdminClusterPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import {
  CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
  type ConsoleAdminClusterPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

export function AdminClusterPageShell() {
  const { t } = useI18n();
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleAdminClusterPageSnapshot>(
      CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
    );

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleAdminClusterPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={t(error ?? "Fugue could not load the cluster snapshot right now.")}
              title={t("Cluster snapshot unavailable")}
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = data.errors.length
    ? t("Partial admin data: {details}.", { details: data.errors.join(" | ") })
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <AdminControlPlanePanel controlPlane={data.controlPlane} />

      <AdminSummaryGrid
        items={[
          { label: t("Nodes"), value: data.summary.nodeCount },
          { label: t("Clear"), value: data.summary.readyCount },
          { label: t("Attention"), value: data.summary.pressuredCount },
          { label: t("Workloads"), value: data.summary.workloadCount },
        ]}
      />

      <AdminClusterOverview nodes={data.nodes} />
    </div>
  );
}
