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
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ConsoleAdminAppsPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import {
  PlatformAlert,
  PlatformErrorState,
} from "@/components/platform/platform-feedback";
import {
  PlatformPage,
  PlatformPageHeader,
  PlatformSection,
} from "@/components/platform/platform-layout";
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
import { isAbortRequestError } from "@/lib/ui/request-json";

const ADMIN_APPS_USAGE_SNAPSHOT_TTL_MS = 300_000;

type AdminAppsUsageSnapshot = {
  apps: Array<{
    id: string;
    resourceUsage: ConsoleCompactResourceItemView[];
  }>;
  pending?: boolean;
};

function isEmptyUsageLabel(label: string | null | undefined) {
  return !label || label === "No stats" || label === "-";
}

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

function hasAdminAppUsageImageData(
  resourceUsage: ConsoleCompactResourceItemView[] | undefined,
) {
  const imageUsage = resourceUsage?.find((item) => item.id === "images");
  return Boolean(
    imageUsage &&
      !isEmptyUsageLabel(imageUsage.primaryLabel),
  );
}

function hasLoadedAdminAppUsage(
  resourceUsage: ConsoleCompactResourceItemView[] | undefined,
) {
  return Boolean(
    resourceUsage?.some(
      (item) => !isEmptyUsageLabel(item.primaryLabel),
    ),
  );
}

function withLocaleSnapshotUrl(url: string, locale: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}locale=${encodeURIComponent(locale)}`;
}

function readAdminAppsUsageSnapshot(snapshotUrl: string) {
  return readConsolePageSnapshot<AdminAppsUsageSnapshot>(
    snapshotUrl,
    {
      allowStale: true,
      ttlMs: ADMIN_APPS_USAGE_SNAPSHOT_TTL_MS,
    },
  );
}

export function AdminAppsPageShell({
  initialSnapshot = null,
}: {
  initialSnapshot?: ConsoleAdminAppsPageSnapshot | null;
}) {
  const { locale, t } = useI18n();
  const pageSnapshotUrl = useMemo(
    () => withLocaleSnapshotUrl(CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL, locale),
    [locale],
  );
  const usageSnapshotUrl = useMemo(
    () =>
      withLocaleSnapshotUrl(
        CONSOLE_ADMIN_APPS_PAGE_USAGE_SNAPSHOT_URL,
        locale,
      ),
    [locale],
  );
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminAppsPageSnapshot>(
      pageSnapshotUrl,
      {
        initialData: initialSnapshot,
      },
    );
  const [usageByAppId, setUsageByAppId] = useState<
    Record<string, ConsoleCompactResourceItemView[]>
  >(() =>
    buildAdminAppUsageMap(readAdminAppsUsageSnapshot(usageSnapshotUrl)),
  );

  useEffect(() => {
    if (!data?.apps.length) {
      setUsageByAppId({});
      return;
    }

    const cachedUsage = buildAdminAppUsageMap(
      readAdminAppsUsageSnapshot(usageSnapshotUrl),
    );

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByAppId(cachedUsage);
      });
    }
  }, [data, usageSnapshotUrl]);

  const appUsageWarmupKey = useMemo(
    () => (data?.apps ?? []).map((app) => app.id).join("||"),
    [data],
  );
  const warmAdminAppUsage = useEffectEvent((signal: AbortSignal) => {
    if (!data?.apps.length) {
      return;
    }

    const cachedUsage = buildAdminAppUsageMap(
      readAdminAppsUsageSnapshot(usageSnapshotUrl),
    );

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByAppId(cachedUsage);
      });
    }

    const needsUsageFetch = data.apps.some((app) => {
      const nextUsage = cachedUsage[app.id] ?? app.resourceUsage;
      return (
        !hasLoadedAdminAppUsage(nextUsage) ||
        !hasAdminAppUsageImageData(nextUsage)
      );
    });

    if (!needsUsageFetch) {
      return;
    }

    const applyUsageSnapshot = (snapshot: AdminAppsUsageSnapshot) => {
      if (signal.aborted) {
        return;
      }

      startTransition(() => {
        setUsageByAppId(buildAdminAppUsageMap(snapshot));
      });
    };
    const retryUsageSnapshot = (attempt: number) => {
      if (attempt > 5) {
        return;
      }

      window.setTimeout(() => {
        if (signal.aborted) {
          return;
        }

        void fetchConsolePageSnapshot<AdminAppsUsageSnapshot>(
          usageSnapshotUrl,
          {
            force: true,
            signal,
            ttlMs: ADMIN_APPS_USAGE_SNAPSHOT_TTL_MS,
          },
        )
          .then((snapshot) => {
            applyUsageSnapshot(snapshot);

            if (snapshot.pending) {
              retryUsageSnapshot(attempt + 1);
            }
          })
          .catch((error) => {
            if (!signal.aborted && !isAbortRequestError(error)) {
              console.error("Admin apps usage refresh failed.", error);
            }
          });
      }, 1_000);
    };

    void fetchConsolePageSnapshot<AdminAppsUsageSnapshot>(
      usageSnapshotUrl,
      {
        signal,
        ttlMs: ADMIN_APPS_USAGE_SNAPSHOT_TTL_MS,
      },
    )
      .then((snapshot) => {
        applyUsageSnapshot(snapshot);

        if (snapshot.pending) {
          retryUsageSnapshot(1);
        }
      })
      .catch((error) => {
        if (!signal.aborted && !isAbortRequestError(error)) {
          console.error("Admin apps usage refresh failed.", error);
        }
      });
  });

  useAnticipatoryWarmup(
    data?.apps.length ? warmAdminAppUsage : null,
    [appUsageWarmupKey, usageSnapshotUrl],
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
      <PlatformPage className="fg-console-page">
        <PlatformErrorState
          copy={t(error ?? "Fugue could not load the admin apps snapshot right now.")}
          title={t("Cluster apps unavailable")}
        />
      </PlatformPage>
    );
  }

  const errorMessage = pageData.errors.length
    ? t("Partial admin data: {details}.", { details: pageData.errors.join(" | ") })
    : null;

  return (
    <PlatformPage className="fg-console-page fg-console-page--admin">
      <ToastOnMount message={errorMessage} variant="error" />

      <PlatformPageHeader
        description={t("Inspect all cluster apps, tenants, routing state, rebuild controls, and deletes.")}
        eyebrow={t("Admin")}
        title={t("Apps")}
      />

      {errorMessage ? (
        <PlatformAlert tone="danger" title={t("Partial admin data")}>
          {errorMessage}
        </PlatformAlert>
      ) : null}

      <AdminSummaryGrid
        items={[
          { label: t("Apps"), value: pageData.summary.appCount },
          { label: t("Routed"), value: pageData.summary.routedCount },
          { label: t("Tenants"), value: pageData.summary.tenantCount },
          { label: t("Last update"), value: pageData.summary.latestUpdateLabel },
        ]}
      />

      <PlatformSection
        description={t("Operate cluster apps without leaving the admin surface.")}
        title={t("Cluster apps")}
      >
        <AdminAppManager
          apps={pageData.apps}
          onRefresh={() => {
            void refresh({ force: true });
          }}
        />
      </PlatformSection>
    </PlatformPage>
  );
}
