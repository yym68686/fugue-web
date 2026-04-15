"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

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
  CONSOLE_ADMIN_CLUSTER_CONTROL_PLANE_SNAPSHOT_URL,
  CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
  type ConsoleAdminClusterPageSnapshot,
  fetchConsolePageSnapshot,
  readConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { useAnticipatoryWarmup } from "@/lib/ui/anticipatory-warmup";

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

export function AdminClusterPageShell() {
  const { t } = useI18n();
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleAdminClusterPageSnapshot>(
      CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL,
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

  const warmControlPlane = useEffectEvent(async (signal: AbortSignal) => {
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

    const nextControlPlane =
      await fetchConsolePageSnapshot<AdminClusterControlPlaneSnapshot>(
        CONSOLE_ADMIN_CLUSTER_CONTROL_PLANE_SNAPSHOT_URL,
        {
          force: true,
          signal,
          ttlMs: ADMIN_CLUSTER_CONTROL_PLANE_TTL_MS,
        },
      );

    if (signal.aborted) {
      return;
    }

    startTransition(() => {
      setControlPlaneSnapshot(nextControlPlane);
    });
  });

  useAnticipatoryWarmup(data && !data.controlPlane ? warmControlPlane : null, [
    data?.controlPlane ? "ready" : "pending",
  ], {
    mode: "idle",
    timeoutMs: 3_000,
  });

  const pageData = useMemo(() => {
    if (!data) {
      return null;
    }

    return mergeAdminClusterSnapshot(data, controlPlaneSnapshot);
  }, [controlPlaneSnapshot, data]);

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
              description={t(error ?? "Fugue could not load the cluster snapshot right now.")}
              title={t("Cluster snapshot unavailable")}
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = pageData.errors.length
    ? t("Partial admin data: {details}.", { details: pageData.errors.join(" | ") })
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <AdminControlPlanePanel controlPlane={pageData.controlPlane} />

      <AdminSummaryGrid
        items={[
          { label: t("Nodes"), value: pageData.summary.nodeCount },
          { label: t("Clear"), value: pageData.summary.readyCount },
          { label: t("Attention"), value: pageData.summary.pressuredCount },
          { label: t("Workloads"), value: pageData.summary.workloadCount },
        ]}
      />

      <AdminClusterOverview nodes={pageData.nodes} />
    </div>
  );
}
