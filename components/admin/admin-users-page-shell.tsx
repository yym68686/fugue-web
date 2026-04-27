"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ConsoleAdminUsersPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import {
  CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_USERS_PAGE_ENRICHMENT_SNAPSHOT_URL,
  CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
  type ConsoleAdminUsersPageSnapshot,
  readConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { useAnticipatoryWarmup } from "@/lib/ui/anticipatory-warmup";

const ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS = 300_000;
const ADMIN_USERS_ENRICHMENT_SNAPSHOT_TTL_MS = 300_000;

type AdminUsersUsageSnapshot = {
  users: Array<{
    email: string;
    serviceCount: number;
    usage: {
      cpuLabel: string;
      diskLabel: string;
      imageLabel: string;
      loading: boolean;
      memoryLabel: string;
      serviceCount: number;
      serviceCountLabel: string;
    };
  }>;
};

function buildAdminUserUsageMap(
  snapshot: AdminUsersUsageSnapshot | null,
) {
  return (snapshot?.users ?? []).reduce<
    Record<
      string,
      {
        serviceCount: number;
        usage: AdminUsersUsageSnapshot["users"][number]["usage"];
      }
    >
  >((accumulator, user) => {
    if (user.email.trim()) {
      accumulator[user.email] = {
        serviceCount: user.serviceCount,
        usage: user.usage,
      };
    }

    return accumulator;
  }, {});
}

function hasAdminUserUsageImageData(
  usage: AdminUsersUsageSnapshot["users"][number]["usage"] | undefined,
) {
  return Boolean(usage && usage.imageLabel && usage.imageLabel !== "No stats");
}

function buildAdminUsersEnrichmentMap(
  snapshot: ConsoleAdminUsersPageSnapshot | null,
) {
  return (snapshot?.users ?? []).reduce<
    Record<string, ConsoleAdminUsersPageSnapshot["users"][number]>
  >((accumulator, user) => {
    if (user.email.trim()) {
      accumulator[user.email] = user;
    }

    return accumulator;
  }, {});
}

function readAdminUsersUsageSnapshot() {
  return readConsolePageSnapshot<AdminUsersUsageSnapshot>(
    CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
    {
      allowStale: true,
      ttlMs: ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS,
    },
  );
}

function readAdminUsersEnrichmentSnapshot() {
  return readConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
    CONSOLE_ADMIN_USERS_PAGE_ENRICHMENT_SNAPSHOT_URL,
    {
      allowStale: true,
      ttlMs: ADMIN_USERS_ENRICHMENT_SNAPSHOT_TTL_MS,
    },
  );
}

export function AdminUsersPageShell({
  initialSnapshot = null,
}: {
  initialSnapshot?: ConsoleAdminUsersPageSnapshot | null;
}) {
  const { t } = useI18n();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
      CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
      {
        initialData: initialSnapshot,
      },
    );
  const [usageByEmail, setUsageByEmail] = useState<
    Record<
      string,
      {
        serviceCount: number;
        usage: AdminUsersUsageSnapshot["users"][number]["usage"];
      }
    >
  >(() =>
    buildAdminUserUsageMap(readAdminUsersUsageSnapshot()),
  );
  const [enrichedUsersByEmail, setEnrichedUsersByEmail] = useState<
    Record<string, ConsoleAdminUsersPageSnapshot["users"][number]>
  >(() =>
    buildAdminUsersEnrichmentMap(readAdminUsersEnrichmentSnapshot()),
  );

  useEffect(() => {
    if (!data?.users.length) {
      setUsageByEmail({});
      setEnrichedUsersByEmail({});
      return;
    }

    const cachedUsage = buildAdminUserUsageMap(readAdminUsersUsageSnapshot());
    const cachedEnrichment = buildAdminUsersEnrichmentMap(
      readAdminUsersEnrichmentSnapshot(),
    );

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByEmail(cachedUsage);
      });
    }

    if (Object.keys(cachedEnrichment).length > 0) {
      startTransition(() => {
        setEnrichedUsersByEmail(cachedEnrichment);
      });
    }
  }, [data]);

  const userUsageWarmupKey = useMemo(
    () => (data?.users ?? []).map((user) => user.email).join("||"),
    [data],
  );
  const warmAdminUserUsage = useEffectEvent((_signal: AbortSignal) => {
    if (!data?.users.length) {
      return;
    }

    const cachedUsage = buildAdminUserUsageMap(readAdminUsersUsageSnapshot());

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByEmail(cachedUsage);
      });
    }

    const needsUsageFetch = data.users.some((user) => {
      const nextUsage = cachedUsage[user.email]?.usage ?? user.usage;
      return !cachedUsage[user.email] || !hasAdminUserUsageImageData(nextUsage);
    });

    if (!needsUsageFetch) {
      return;
    }
    // User usage is refreshed by the server route after the base snapshot is
    // returned. Keep initial page entry to cached data only.
  });

  const userEnrichmentWarmupKey = useMemo(
    () =>
      (data?.users ?? [])
        .map((user) => `${user.email}:${user.billing.loading ? "loading" : "ready"}`)
        .join("||"),
    [data],
  );
  const warmAdminUserEnrichment = useEffectEvent((_signal: AbortSignal) => {
    if (!data?.users.length) {
      return;
    }

    const cachedEnrichment = buildAdminUsersEnrichmentMap(
      readAdminUsersEnrichmentSnapshot(),
    );

    if (Object.keys(cachedEnrichment).length > 0) {
      startTransition(() => {
        setEnrichedUsersByEmail(cachedEnrichment);
      });
    }

    const needsEnrichmentFetch = data.users.some(
      (user) =>
        !cachedEnrichment[user.email] || cachedEnrichment[user.email].billing.loading,
    );

    if (!needsEnrichmentFetch) {
      return;
    }
    // Billing and registry enrichment stays server-side on initial navigation.
  });

  useAnticipatoryWarmup(
    data?.users.length ? warmAdminUserUsage : null,
    [userUsageWarmupKey],
    {
      mode: "idle",
      timeoutMs: 3_000,
    },
  );
  useAnticipatoryWarmup(
    data?.users.length ? warmAdminUserEnrichment : null,
    [userEnrichmentWarmupKey],
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
      enrichmentState:
        Object.keys(enrichedUsersByEmail).length > 0 ? "ready" : data.enrichmentState,
      users: data.users.map((user) => {
        const enrichedUser = enrichedUsersByEmail[user.email];
        const patch = usageByEmail[user.email];
        const nextUser = enrichedUser
          ? {
              ...user,
              ...enrichedUser,
            }
          : user;

        if (!patch) {
          return nextUser;
        }

        return {
          ...nextUser,
          serviceCount: patch.serviceCount,
          usage: patch.usage,
        };
      }),
    } satisfies ConsoleAdminUsersPageSnapshot;
  }, [data, enrichedUsersByEmail, usageByEmail]);

  if (loading && !pageData) {
    return (
      <ConsoleLoadingState label={t("Loading users")}>
        <ConsoleAdminUsersPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!pageData) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={t(error ?? "Fugue could not load the admin users snapshot right now.")}
              title={t("Users unavailable")}
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorDetails = [...pageData.errors];
  const errorMessage = errorDetails.length
    ? t("Partial admin data: {details}.", { details: errorDetails.join(" | ") })
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <AdminSummaryGrid
        items={[
          { label: t("Users"), value: pageData.summary.userCount },
          { label: t("Admins"), value: pageData.summary.adminCount },
          { label: t("Blocked"), value: pageData.summary.blockedCount },
          { label: t("Deleted"), value: pageData.summary.deletedCount },
        ]}
      />

      <Panel>
        <PanelSection>
          <AdminUserManager
            onRefresh={() => {
              void refresh({ force: true });
            }}
            users={pageData.users}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
