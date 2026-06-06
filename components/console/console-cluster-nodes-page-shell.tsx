"use client";

import { ApiKeyEmptyState } from "@/components/console/api-key-empty-state";
import { AttachedServerOverview } from "@/components/console/attached-server-overview";
import { OfflineServerOverview } from "@/components/console/offline-server-overview";
import {
  ConsoleClusterNodesPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { ConsoleSummaryGrid } from "@/components/console/console-summary-grid";
import {
  PlatformAlert,
  PlatformEmptyState,
  PlatformErrorState,
} from "@/components/platform/platform-feedback";
import {
  PlatformPage,
  PlatformPageHeader,
  PlatformSection,
} from "@/components/platform/platform-layout";
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
      <PlatformPage className="fg-console-page">
        <PlatformErrorState
          copy={error ?? t("Fugue could not load the server inventory right now.")}
          title={t("Server inventory unavailable")}
        />
      </PlatformPage>
    );
  }

  if (data.state === "workspace-missing") {
    return (
      <PlatformPage className="fg-console-page">
        <PlatformEmptyState
          copy={t("Bootstrap a workspace before enrolling servers into Fugue.")}
          title={t("Workspace missing")}
        />
        <ApiKeyEmptyState />
      </PlatformPage>
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
    <PlatformPage className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <PlatformPageHeader
        description={t("Monitor attached runtime servers, capacity, heartbeat, and offline records.")}
        eyebrow={t("Runtime")}
        title={t("Servers")}
      />

      {errorMessage ? (
        <PlatformAlert tone="danger" title={t("Partial server data")}>
          {errorMessage}
        </PlatformAlert>
      ) : null}

      <ConsoleSummaryGrid
        ariaLabel={t("Server summary")}
        items={[
          { label: t("Servers"), value: data.data.summary.nodeCount },
          { label: t("Ready"), value: data.data.summary.readyCount },
          { label: t("Offline"), value: data.data.summary.offlineCount },
          { label: t("Workloads"), value: data.data.summary.workloadCount },
        ]}
      />

      {hasLiveNodes ? (
        <PlatformSection
          description={t("Expand a server for access, capacity, and placement.")}
          title={t("Server inventory")}
        >
          <AttachedServerOverview
            inventoryError={errorMessage}
            isAdmin={data.isAdmin}
            nodes={data.data.nodes}
          />
        </PlatformSection>
      ) : hasOfflineServers ? (
        <PlatformEmptyState
          copy={t(
            "No live servers are reporting right now. Offline servers that still belong to this workspace are listed below.",
          )}
          title={t("No live servers right now")}
        />
      ) : (
        <PlatformSection
          description={t("Expand a server for access, capacity, and placement.")}
          title={t("Server inventory")}
        >
          <AttachedServerOverview
            inventoryError={errorMessage}
            isAdmin={data.isAdmin}
            nodes={data.data.nodes}
          />
        </PlatformSection>
      )}

      {hasOfflineServers ? (
        <PlatformSection
          description={t(
            "Delete server records here after the underlying VPS is permanently gone.",
          )}
          title={t("Offline servers")}
        >
          <OfflineServerOverview
            onRefresh={refresh}
            servers={data.data.offlineServers}
          />
        </PlatformSection>
      ) : null}
    </PlatformPage>
  );
}
