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
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ConsoleAdminUsersPageSkeleton,
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
import {
  CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
  CONSOLE_ADMIN_USERS_PAGE_ENRICHMENT_SNAPSHOT_URL,
  CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
  type ConsoleAdminUsersPageSnapshot,
  fetchConsolePageSnapshot,
  readConsolePageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import { useAnticipatoryWarmup } from "@/lib/ui/anticipatory-warmup";
import { isAbortRequestError } from "@/lib/ui/request-json";

const ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS = 300_000;
const ADMIN_USERS_ENRICHMENT_SNAPSHOT_TTL_MS = 300_000;

type AdminUsersUsageSnapshot = {
  pending?: boolean;
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

function isEmptyUsageLabel(label: string | null | undefined) {
  return !label || label === "No stats" || label === "-";
}

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
  return Boolean(usage && !isEmptyUsageLabel(usage.imageLabel));
}

function hasLoadedAdminUserUsage(
  usage: AdminUsersUsageSnapshot["users"][number]["usage"] | undefined,
) {
  return Boolean(
    usage &&
      !usage.loading &&
      [usage.cpuLabel, usage.memoryLabel, usage.diskLabel, usage.imageLabel].some(
        (label) => !isEmptyUsageLabel(label),
      ),
  );
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

function withLocaleSnapshotUrl(url: string, locale: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}locale=${encodeURIComponent(locale)}`;
}

function readAdminUsersUsageSnapshot(snapshotUrl: string) {
  return readConsolePageSnapshot<AdminUsersUsageSnapshot>(
    snapshotUrl,
    {
      allowStale: true,
      ttlMs: ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS,
    },
  );
}

function readAdminUsersEnrichmentSnapshot(snapshotUrl: string) {
  return readConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
    snapshotUrl,
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
  const { locale, t } = useI18n();
  const pageSnapshotUrl = useMemo(
    () => withLocaleSnapshotUrl(CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL, locale),
    [locale],
  );
  const usageSnapshotUrl = useMemo(
    () =>
      withLocaleSnapshotUrl(
        CONSOLE_ADMIN_USERS_PAGE_USAGE_SNAPSHOT_URL,
        locale,
      ),
    [locale],
  );
  const enrichmentSnapshotUrl = useMemo(
    () =>
      withLocaleSnapshotUrl(
        CONSOLE_ADMIN_USERS_PAGE_ENRICHMENT_SNAPSHOT_URL,
        locale,
      ),
    [locale],
  );
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
      pageSnapshotUrl,
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
    buildAdminUserUsageMap(readAdminUsersUsageSnapshot(usageSnapshotUrl)),
  );
  const [enrichedUsersByEmail, setEnrichedUsersByEmail] = useState<
    Record<string, ConsoleAdminUsersPageSnapshot["users"][number]>
  >(() =>
    buildAdminUsersEnrichmentMap(
      readAdminUsersEnrichmentSnapshot(enrichmentSnapshotUrl),
    ),
  );

  useEffect(() => {
    if (!data?.users.length) {
      setUsageByEmail({});
      setEnrichedUsersByEmail({});
      return;
    }

    const cachedUsage = buildAdminUserUsageMap(
      readAdminUsersUsageSnapshot(usageSnapshotUrl),
    );
    const cachedEnrichment = buildAdminUsersEnrichmentMap(
      readAdminUsersEnrichmentSnapshot(enrichmentSnapshotUrl),
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
  }, [data, enrichmentSnapshotUrl, usageSnapshotUrl]);

  const userUsageWarmupKey = useMemo(
    () => (data?.users ?? []).map((user) => user.email).join("||"),
    [data],
  );
  const warmAdminUserUsage = useEffectEvent((signal: AbortSignal) => {
    if (!data?.users.length) {
      return;
    }

    const cachedUsage = buildAdminUserUsageMap(
      readAdminUsersUsageSnapshot(usageSnapshotUrl),
    );

    if (Object.keys(cachedUsage).length > 0) {
      startTransition(() => {
        setUsageByEmail(cachedUsage);
      });
    }

    const needsUsageFetch = data.users.some((user) => {
      const nextUsage = cachedUsage[user.email]?.usage ?? user.usage;
      return (
        !hasLoadedAdminUserUsage(nextUsage) ||
        !hasAdminUserUsageImageData(nextUsage)
      );
    });

    if (!needsUsageFetch) {
      return;
    }

    const applyUsageSnapshot = (snapshot: AdminUsersUsageSnapshot) => {
      if (signal.aborted) {
        return;
      }

      startTransition(() => {
        setUsageByEmail(buildAdminUserUsageMap(snapshot));
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

        void fetchConsolePageSnapshot<AdminUsersUsageSnapshot>(
          usageSnapshotUrl,
          {
            force: true,
            signal,
            ttlMs: ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS,
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
              console.error("Admin users usage refresh failed.", error);
            }
          });
      }, 1_000);
    };

    void fetchConsolePageSnapshot<AdminUsersUsageSnapshot>(
      usageSnapshotUrl,
      {
        signal,
        ttlMs: ADMIN_USERS_USAGE_SNAPSHOT_TTL_MS,
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
          console.error("Admin users usage refresh failed.", error);
        }
      });
  });

  const userEnrichmentWarmupKey = useMemo(
    () =>
      (data?.users ?? [])
        .map((user) => `${user.email}:${user.billing.loading ? "loading" : "ready"}`)
        .join("||"),
    [data],
  );
  const warmAdminUserEnrichment = useEffectEvent((signal: AbortSignal) => {
    if (!data?.users.length) {
      return;
    }

    const cachedEnrichment = buildAdminUsersEnrichmentMap(
      readAdminUsersEnrichmentSnapshot(enrichmentSnapshotUrl),
    );

    if (Object.keys(cachedEnrichment).length > 0) {
      startTransition(() => {
        setEnrichedUsersByEmail(cachedEnrichment);
      });
    }

    const needsEnrichmentFetch =
      data.enrichmentState !== "ready" ||
      data.users.some(
        (user) =>
          !cachedEnrichment[user.email] ||
          cachedEnrichment[user.email].billing.loading,
      );

    if (!needsEnrichmentFetch) {
      return;
    }

    void fetchConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
      enrichmentSnapshotUrl,
      {
        force: true,
        signal,
        ttlMs: ADMIN_USERS_ENRICHMENT_SNAPSHOT_TTL_MS,
      },
    )
      .then((snapshot) => {
        if (signal.aborted) {
          return;
        }

        startTransition(() => {
          setEnrichedUsersByEmail(buildAdminUsersEnrichmentMap(snapshot));
        });
      })
      .catch((error) => {
        if (!signal.aborted && !isAbortRequestError(error)) {
          console.error("Admin users enrichment refresh failed.", error);
        }
      });
  });

  useAnticipatoryWarmup(
    data?.users.length ? warmAdminUserUsage : null,
    [userUsageWarmupKey, usageSnapshotUrl],
    {
      mode: "idle",
      timeoutMs: 3_000,
    },
  );
  useAnticipatoryWarmup(
    data?.users.length ? warmAdminUserEnrichment : null,
    [enrichmentSnapshotUrl, userEnrichmentWarmupKey],
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
      <PlatformPage className="fg-console-page">
        <PlatformErrorState
          copy={t(error ?? "Fugue could not load the admin users snapshot right now.")}
          title={t("Users unavailable")}
        />
      </PlatformPage>
    );
  }

  const errorDetails = [...pageData.errors];
  const errorMessage = errorDetails.length
    ? t("Partial admin data: {details}.", { details: errorDetails.join(" | ") })
    : null;

  return (
    <PlatformPage className="fg-console-page fg-console-page--admin">
      <ToastOnMount message={errorMessage} variant="error" />

      <PlatformPageHeader
        description={t("Review users, admin status, quotas, service usage, and account state.")}
        eyebrow={t("Admin")}
        title={t("Users")}
      />

      {errorMessage ? (
        <PlatformAlert tone="danger" title={t("Partial admin data")}>
          {errorMessage}
        </PlatformAlert>
      ) : null}

      <AdminSummaryGrid
        items={[
          { label: t("Users"), value: pageData.summary.userCount },
          { label: t("Admins"), value: pageData.summary.adminCount },
          { label: t("Blocked"), value: pageData.summary.blockedCount },
          { label: t("Deleted"), value: pageData.summary.deletedCount },
        ]}
      />

      <PlatformSection
        description={t("Manage account state and quota context from the admin surface.")}
        title={t("User directory")}
      >
        <AdminUserManager
          onRefresh={() => {
            void refresh({ force: true });
          }}
          users={pageData.users}
        />
      </PlatformSection>
    </PlatformPage>
  );
}
