"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { AdminControlPlanePanel } from "@/components/admin/admin-control-plane-panel";
import { AdminClusterNodeManager } from "@/components/admin/admin-cluster-node-manager";
import { AdminPlatformNodeEnrollmentPanel } from "@/components/admin/admin-platform-node-enrollment-panel";
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
  CONSOLE_ADMIN_CLUSTER_CONTROL_PLANE_SNAPSHOT_URL,
  CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
  type ConsoleAdminClusterPageSnapshot,
  writeConsolePageSnapshot,
  readConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { useAnticipatoryWarmup } from "@/lib/ui/anticipatory-warmup";
import type { AdminClusterNodeView } from "@/lib/admin/service";

const ADMIN_CLUSTER_CONTROL_PLANE_TTL_MS = 300_000;

type AdminClusterControlPlaneSnapshot = {
  controlPlane: ConsoleAdminClusterPageSnapshot["controlPlane"];
  errors: string[];
};

function readAdminClusterControlPlaneSnapshot() {
  return readConsolePageSnapshot<AdminClusterControlPlaneSnapshot>(
    CONSOLE_ADMIN_CLUSTER_CONTROL_PLANE_SNAPSHOT_URL,
    {
      allowStale: true,
      ttlMs: ADMIN_CLUSTER_CONTROL_PLANE_TTL_MS,
    },
  );
}

function mergeAdminClusterSnapshot(
  base: ConsoleAdminClusterPageSnapshot,
  sidecar: AdminClusterControlPlaneSnapshot | null,
) {
  if (!sidecar?.controlPlane) {
    return base;
  }

  return {
    ...base,
    controlPlane: sidecar.controlPlane,
    errors: [
      ...base.errors.filter((error) => !error.startsWith("control plane:")),
      ...sidecar.errors,
    ],
  } satisfies ConsoleAdminClusterPageSnapshot;
}

function buildClusterSummary(nodes: AdminClusterNodeView[]) {
  return {
    nodeCount: nodes.length,
    pressuredCount: nodes.filter(
      (node) =>
        node.statusTone === "warning" ||
        node.statusTone === "danger" ||
        node.resources.some(
          (resource) =>
            resource.statusTone === "warning" ||
            resource.statusTone === "danger",
        ),
    ).length,
    readyCount: nodes.filter((node) => node.statusLabel === "Ready").length,
    workloadCount: nodes.reduce((total, node) => total + node.workloadCount, 0),
  };
}

export function AdminClusterPageShell({
  initialSnapshot = null,
}: {
  initialSnapshot?: ConsoleAdminClusterPageSnapshot | null;
}) {
  const { t } = useI18n();
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleAdminClusterPageSnapshot>(
      CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
      {
        initialData: initialSnapshot,
      },
    );
  const [controlPlaneSnapshot, setControlPlaneSnapshot] =
    useState<AdminClusterControlPlaneSnapshot | null>(() =>
      readAdminClusterControlPlaneSnapshot(),
    );

  useEffect(() => {
    if (!data) {
      setControlPlaneSnapshot(null);
      return;
    }

    const cachedControlPlane = readAdminClusterControlPlaneSnapshot();

    if (cachedControlPlane?.controlPlane) {
      startTransition(() => {
        setControlPlaneSnapshot(cachedControlPlane);
      });
    }
  }, [data]);

  const warmControlPlane = useEffectEvent((_signal: AbortSignal) => {
    if (!data || data.controlPlane) {
      return;
    }

    const cachedControlPlane = readAdminClusterControlPlaneSnapshot();

    if (cachedControlPlane?.controlPlane) {
      startTransition(() => {
        setControlPlaneSnapshot(cachedControlPlane);
      });
      return;
    }
    // The base route soft-loads control-plane state and refreshes it server-side.
    // Avoid a client sidecar fetch on first navigation.
  });

  useAnticipatoryWarmup(
    data && !data.controlPlane ? warmControlPlane : null,
    [data?.controlPlane ? "ready" : "pending"],
    {
      mode: "idle",
      timeoutMs: 3_000,
    },
  );

  const pageData = useMemo(() => {
    if (!data) {
      return null;
    }

    return mergeAdminClusterSnapshot(data, controlPlaneSnapshot);
  }, [controlPlaneSnapshot, data]);
  const [nodes, setNodes] = useState<AdminClusterNodeView[]>([]);

  useEffect(() => {
    setNodes(pageData?.nodes ?? []);
  }, [pageData]);

  if (loading && !pageData) {
    return (
      <ConsoleLoadingState>
        <ConsoleAdminClusterPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!pageData) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={t(
                error ?? "Fugue could not load the cluster snapshot right now.",
              )}
              title={t("Cluster snapshot unavailable")}
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = pageData.errors.length
    ? t("Partial admin data: {details}.", {
        details: pageData.errors.join(" | "),
      })
    : null;
  const summary = buildClusterSummary(nodes);

  function handleNodeUpdated(nextNode: AdminClusterNodeView) {
    if (!pageData) {
      return;
    }

    const snapshotBase = pageData;

    setNodes((current) => {
      const nextNodes = current
        .map((node) => (node.name === nextNode.name ? nextNode : node))
        .sort((left, right) => left.name.localeCompare(right.name));
      const nextSnapshot: ConsoleAdminClusterPageSnapshot = {
        controlPlane: snapshotBase.controlPlane ?? null,
        errors: snapshotBase.errors,
        nodes: nextNodes,
        summary: buildClusterSummary(nextNodes),
      };

      writeConsolePageSnapshot<ConsoleAdminClusterPageSnapshot>(
        CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
        nextSnapshot,
      );
      return nextNodes;
    });
  }

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <AdminControlPlanePanel controlPlane={pageData.controlPlane} />

      <AdminSummaryGrid
        items={[
          { label: t("Nodes"), value: summary.nodeCount },
          { label: t("Clear"), value: summary.readyCount },
          { label: t("Attention"), value: summary.pressuredCount },
          { label: t("Workloads"), value: summary.workloadCount },
        ]}
      />

      <AdminPlatformNodeEnrollmentPanel />

      <AdminClusterNodeManager
        nodes={nodes}
        onNodeUpdated={handleNodeUpdated}
      />
    </div>
  );
}
