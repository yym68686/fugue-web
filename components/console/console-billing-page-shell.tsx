"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { BillingPanel } from "@/components/console/billing-panel";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ConsoleBillingPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import {
  CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
  CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL,
  type ConsoleBillingPageSnapshot,
  fetchConsolePageSnapshot,
  readConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { isAbortRequestError } from "@/lib/ui/request-json";

const BILLING_USAGE_SNAPSHOT_TTL_MS = 300_000;

function readBillingUsageSnapshot() {
  return readConsolePageSnapshot<ConsoleBillingPageSnapshot>(
    CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL,
    {
      allowStale: true,
      ttlMs: BILLING_USAGE_SNAPSHOT_TTL_MS,
    },
  );
}

function hasBillingLiveUsage(snapshot: ConsoleBillingPageSnapshot | null) {
  return Boolean(
    snapshot?.state === "ready" &&
      (snapshot.data.billing?.currentUsage !== null ||
        snapshot.data.imageStorageBytes !== null),
  );
}

function hasSameBillingWorkspace(
  baseSnapshot: ConsoleBillingPageSnapshot | null,
  liveSnapshot: ConsoleBillingPageSnapshot | null,
) {
  if (baseSnapshot?.state !== "ready" || liveSnapshot?.state !== "ready") {
    return false;
  }

  const baseTenantId = baseSnapshot.data.workspace.tenantId.trim();
  const liveTenantId = liveSnapshot.data.workspace.tenantId.trim();

  return !baseTenantId || !liveTenantId || baseTenantId === liveTenantId;
}

function mergeBillingSnapshots(
  base: ConsoleBillingPageSnapshot,
  next: ConsoleBillingPageSnapshot | null,
) {
  if (
    base.state !== "ready" ||
    !next ||
    next.state !== "ready" ||
    !hasSameBillingWorkspace(base, next)
  ) {
    return base;
  }

  const billing =
    base.data.billing && next.data.billing
      ? {
          ...base.data.billing,
          currentUsage:
            next.data.billing.currentUsage ?? base.data.billing.currentUsage,
        }
      : next.data.billing ?? base.data.billing;

  return {
    state: "ready",
    data: {
      ...base.data,
      ...next.data,
      billing,
      imageStorageBytes:
        next.data.imageStorageBytes ?? base.data.imageStorageBytes,
      syncError: next.data.syncError ?? base.data.syncError,
      workspace:
        next.data.workspace.tenantId || next.data.workspace.tenantName
          ? next.data.workspace
          : base.data.workspace,
    },
  } satisfies ConsoleBillingPageSnapshot;
}

export function ConsoleBillingPageShell({
  initialSnapshot = null,
}: {
  initialSnapshot?: ConsoleBillingPageSnapshot | null;
}) {
  const { t } = useI18n();
  const { data, error, loading } =
    useConsolePageSnapshot<ConsoleBillingPageSnapshot>(
      CONSOLE_BILLING_PAGE_SNAPSHOT_URL,
      {
        initialData: initialSnapshot,
      },
    );
  const [liveUsageSnapshot, setLiveUsageSnapshot] =
    useState<ConsoleBillingPageSnapshot | null>(() =>
      readBillingUsageSnapshot(),
    );

  useEffect(() => {
    if (data?.state !== "ready") {
      setLiveUsageSnapshot(null);
      return;
    }

    const cachedUsage = readBillingUsageSnapshot();
    const canUseCachedUsage =
      hasBillingLiveUsage(cachedUsage) &&
      hasSameBillingWorkspace(data, cachedUsage);

    if (canUseCachedUsage) {
      startTransition(() => {
        setLiveUsageSnapshot(cachedUsage);
      });
    } else {
      setLiveUsageSnapshot(null);
    }

    if (canUseCachedUsage) {
      return;
    }

    const controller = new AbortController();

    void fetchConsolePageSnapshot<ConsoleBillingPageSnapshot>(
      CONSOLE_BILLING_PAGE_USAGE_SNAPSHOT_URL,
      {
        signal: controller.signal,
        ttlMs: BILLING_USAGE_SNAPSHOT_TTL_MS,
      },
    )
      .then((snapshot) => {
        if (
          controller.signal.aborted ||
          snapshot.state !== "ready" ||
          !hasBillingLiveUsage(snapshot) ||
          !hasSameBillingWorkspace(data, snapshot)
        ) {
          return;
        }

        startTransition(() => {
          setLiveUsageSnapshot(snapshot);
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortRequestError(error)) {
          console.error("Billing usage refresh failed.", error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [data]);

  const pageData = useMemo(() => {
    if (!data) {
      return null;
    }

    return mergeBillingSnapshots(data, liveUsageSnapshot);
  }, [data, liveUsageSnapshot]);

  if (loading && !pageData) {
    return (
      <ConsoleLoadingState>
        <ConsoleBillingPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!pageData) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? t("Fugue could not load the billing snapshot right now.")}
              title={t("Billing snapshot unavailable")}
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  return (
    <div className="fg-console-page">
      {pageData.state === "ready" ? (
        <BillingPanel
          initialBilling={pageData.data.billing}
          initialImageStorageBytes={pageData.data.imageStorageBytes}
          initialSyncError={pageData.data.syncError}
          workspaceName={pageData.data.workspace.tenantName}
        />
      ) : (
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              action={{
                href: "/app/api-keys",
                label: t("Open access setup"),
                variant: "primary",
              }}
              description={t(
                "Create the workspace admin access first so Fugue can read and update tenant billing.",
              )}
              title={t("Billing needs a workspace")}
            />
          </PanelSection>
        </Panel>
      )}
    </div>
  );
}
