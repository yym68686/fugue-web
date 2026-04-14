"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

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
  CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
  type ConsoleAdminUsersPageSnapshot,
  fetchConsolePageSnapshot,
  readConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

const ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS = 30_000;

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

export function AdminUsersPageShell() {
  const { t } = useI18n();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
      CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
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
    buildAdminUserUsageMap(
      readConsolePageSnapshot<AdminUsersUsageSnapshot>(
        CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
        {
          allowStale: true,
          ttlMs: ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS,
        },
      ),
    ),
  );

  useEffect(() => {
    if (!data?.users.length) {
      setUsageByEmail({});
      return;
    }

    const cached = readConsolePageSnapshot<AdminUsersUsageSnapshot>(
      CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
      {
        allowStale: true,
        ttlMs: ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS,
      },
    );
    const cachedUsage = buildAdminUserUsageMap(cached);
    const needsUsageFetch = data.users.some((user) => !cachedUsage[user.email]);

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByEmail(cachedUsage);
      });
    }

    if (cached && !needsUsageFetch) {
      return;
    }

    let cancelled = false;

    fetchConsolePageSnapshot<AdminUsersUsageSnapshot>(
      CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
      {
        force: needsUsageFetch,
        ttlMs: ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS,
      },
    )
      .then((nextUsage) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setUsageByEmail(buildAdminUserUsageMap(nextUsage));
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [data]);

  const pageData = useMemo(() => {
    if (!data) {
      return null;
    }

    return {
      ...data,
      users: data.users.map((user) => {
        const patch = usageByEmail[user.email];

        if (!patch) {
          return user;
        }

        return {
          ...user,
          serviceCount: patch.serviceCount,
          usage: patch.usage,
        };
      }),
    } satisfies ConsoleAdminUsersPageSnapshot;
  }, [data, usageByEmail]);

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
