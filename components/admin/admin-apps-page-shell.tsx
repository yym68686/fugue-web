"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { AdminAppManager } from "@/components/admin/admin-app-manager";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ConsoleAdminAppsPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import type { ConsoleCompactResourceItemView } from "@/lib/console/gallery-types";
import {
  CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_APPS_PAGE_USAGE_SNAPSHOT_URL,
  type ConsoleAdminAppsPageSnapshot,
  fetchConsolePageSnapshot,
  readConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { useAnticipatoryWarmup } from "@/lib/ui/anticipatory-warmup";

const ADMIN_APPS_USAGE_SNAPSHOT_TTL_MS = 300_000;

type AdminAppsUsageSnapshot = {
  apps: Array<{
    id: string;
    resourceUsage: ConsoleCompactResourceItemView[];
  }>;
};

function buildAdminAppUsageMap(
  snapshot: AdminAppsUsageSnapshot | null,
) {
  return (snapshot?.apps ?? []).reduce<
    Record<string, ConsoleCompactResourceItemView[]>
  >((accumulator, app) => {
    if (app.id.trim()) {
      accumulator[app.id] = app.resourceUsage;
    }

    return accumulator;
  }, {});
}

function readAdminAppsUsageSnapshot() {
  return readConsolePageSnapshot<AdminAppsUsageSnapshot>(
    CONSOLE_ADMIN_APPS_PAGE_USAGE_SNAPSHOT_URL,
    {
      allowStale: true,
      ttlMs: ADMIN_APPS_USAGE_SNAPSHOT_TTL_MS,
    },
  );
}

export function AdminAppsPageShell() {
  const { t } = useI18n();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminAppsPageSnapshot>(
      CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL,
    );
  const [usageByAppId, setUsageByAppId] = useState<
    Record<string, ConsoleCompactResourceItemView[]>
  >(() =>
    buildAdminAppUsageMap(readAdminAppsUsageSnapshot()),
  );

  useEffect(() => {
    if (!data?.apps.length) {
      setUsageByAppId({});
      return;
    }

    const cachedUsage = buildAdminAppUsageMap(readAdminAppsUsageSnapshot());

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByAppId(cachedUsage);
      });
    }
  }, [data]);

  const appUsageWarmupKey = useMemo(
    () => (data?.apps ?? []).map((app) => app.id).join("||"),
    [data],
  );
  const warmAdminAppUsage = useEffectEvent(async (signal: AbortSignal) => {
    if (!data?.apps.length) {
      return;
    }

    const cachedUsage = buildAdminAppUsageMap(readAdminAppsUsageSnapshot());

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByAppId(cachedUsage);
      });
    }

    const needsUsageFetch = data.apps.some((app) => !cachedUsage[app.id]);

    if (!needsUsageFetch) {
      return;
    }

    const nextUsage = await fetchConsolePageSnapshot<AdminAppsUsageSnapshot>(
      CONSOLE_ADMIN_APPS_PAGE_USAGE_SNAPSHOT_URL,
      {
        force: true,
        signal,
        ttlMs: ADMIN_APPS_USAGE_SNAPSHOT_TTL_MS,
      },
    );

    if (signal.aborted) {
      return;
    }

    startTransition(() => {
      setUsageByAppId(buildAdminAppUsageMap(nextUsage));
    });
  });

  useAnticipatoryWarmup(
    data?.apps.length ? warmAdminAppUsage : null,
    [appUsageWarmupKey],
    {
      mode: "idle",
      timeoutMs: 3_000,
    },
  );

  const pageData = useMemo(() => {
    if (!data) {
      return null;
    }

    return {
      ...data,
      apps: data.apps.map((app) => ({
        ...app,
        resourceUsage: usageByAppId[app.id] ?? app.resourceUsage,
      })),
    } satisfies ConsoleAdminAppsPageSnapshot;
  }, [data, usageByAppId]);

  if (loading && !pageData) {
    return (
      <ConsoleLoadingState label={t("Loading apps")}>
        <ConsoleAdminAppsPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!pageData) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={t(error ?? "Fugue could not load the admin apps snapshot right now.")}
              title={t("Cluster apps unavailable")}
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

      <AdminSummaryGrid
        items={[
          { label: t("Apps"), value: pageData.summary.appCount },
          { label: t("Routed"), value: pageData.summary.routedCount },
          { label: t("Tenants"), value: pageData.summary.tenantCount },
          { label: t("Last update"), value: pageData.summary.latestUpdateLabel },
        ]}
      />

      <Panel>
        <PanelSection>
          <AdminAppManager
            apps={pageData.apps}
            onRefresh={() => {
              void refresh({ force: true });
            }}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
