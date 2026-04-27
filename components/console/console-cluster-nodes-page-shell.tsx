"use client";

import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
import { AttachedServerOverview } from "@/components/console/attached-server-overview";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { OfflineServerOverview } from "@/components/console/offline-server-overview";
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
import { useI18n } from "@/components/providers/i18n-provider";

export function ConsoleClusterNodesPageShell({
  initialSnapshot = null,
}: {
  initialSnapshot?: ConsoleClusterNodesPageSnapshot | null;
}) {
  const { t } = useI18n();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleClusterNodesPageSnapshot>(
      CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL,
      {
        initialData: initialSnapshot,
      },
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
              description={
                error ?? t("Fugue could not load the server inventory right now.")
              }
              title={t("Server inventory unavailable")}
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
    ? t("Partial server data: {details}.", {
        details: data.data.errors.join(" | "),
      })
    : null;
  const hasLiveNodes = data.data.nodes.length > 0;
  const hasOfflineServers = data.data.offlineServers.length > 0;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsoleSummaryGrid
        ariaLabel={t("Server summary")}
        items={[
          { label: t("Servers"), value: data.data.summary.nodeCount },
          { label: t("Ready"), value: data.data.summary.readyCount },
          { label: t("Offline"), value: data.data.summary.offlineCount },
          { label: t("Workloads"), value: data.data.summary.workloadCount },
          {
            label: t("Latest signal"),
            value: data.data.summary.latestHeartbeatLabel,
          },
        ]}
      />

      {hasLiveNodes ? (
        <>
          <div className="fg-credential-section__head">
            <div className="fg-credential-section__copy">
              <strong>{t("Server inventory")}</strong>
              <p>{t("Expand a server for access, capacity, and placement.")}</p>
            </div>
          </div>

          <AttachedServerOverview
            inventoryError={errorMessage}
            isAdmin={data.isAdmin}
            nodes={data.data.nodes}
          />
        </>
      ) : hasOfflineServers ? (
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={t(
                "No live servers are reporting right now. Offline servers that still belong to this workspace are listed below.",
              )}
              title={t("No live servers right now")}
            />
          </PanelSection>
        </Panel>
      ) : (
        <>
          <div className="fg-credential-section__head">
            <div className="fg-credential-section__copy">
              <strong>{t("Server inventory")}</strong>
              <p>{t("Expand a server for access, capacity, and placement.")}</p>
            </div>
          </div>

          <AttachedServerOverview
            inventoryError={errorMessage}
            isAdmin={data.isAdmin}
            nodes={data.data.nodes}
          />
        </>
      )}

      {hasOfflineServers ? (
        <>
          <div className="fg-credential-section__head">
            <div className="fg-credential-section__copy">
              <strong>{t("Offline servers")}</strong>
              <p>
                {t(
                  "Delete server records here after the underlying VPS is permanently gone.",
                )}
              </p>
            </div>
          </div>

          <OfflineServerOverview
            onRefresh={refresh}
            servers={data.data.offlineServers}
          />
        </>
      ) : null}
    </div>
  );
}
