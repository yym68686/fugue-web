"use client";

import { startTransition, useEffect, useState } from "react";

import type {
  ConsoleAdminAppsPageSnapshot,
  ConsoleAdminClusterPageSnapshot,
  ConsoleAdminUsersPageSnapshot,
  ConsoleApiKeysPageSnapshot,
  ConsoleBillingPageSnapshot,
  ConsoleClusterNodesPageSnapshot,
  ConsoleWorkspaceSettingsPageSnapshot,
} from "@/lib/console/page-snapshot-types";
import {
  createAbortRequestError,
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

const DEFAULT_CONSOLE_PAGE_SNAPSHOT_TTL_MS = 60_000;

type SnapshotEntry = {
  cachedAt: number;
  value: unknown;
};

type SnapshotFetchOptions = {
  force?: boolean;
  signal?: AbortSignal;
  ttlMs?: number;
};

type UseConsolePageSnapshotResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: (options?: SnapshotFetchOptions) => Promise<T>;
};

const snapshotCache = new Map<string, SnapshotEntry>();
const snapshotRequests = new Map<string, Promise<unknown>>();

export const CONSOLE_BILLING_PAGE_SNAPSHOT_URL =
  "/api/fugue/console/pages/billing";
export const CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL =
  "/api/fugue/console/pages/api-keys";
export const CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL =
  "/api/fugue/console/pages/cluster-nodes";
export const CONSOLE_WORKSPACE_SETTINGS_PAGE_SNAPSHOT_URL =
  "/api/fugue/console/pages/settings/workspace";
export const CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL =
  "/api/fugue/admin/pages/apps";
export const CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL =
  "/api/fugue/admin/pages/users";
export const CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL =
  "/api/fugue/admin/pages/cluster";

const CONSOLE_ROUTE_SNAPSHOT_URLS: Record<string, string[]> = {
  "/app/api-keys": [CONSOLE_API_KEYS_PAGE_SNAPSHOT_URL],
  "/app/apps": [CONSOLE_ADMIN_APPS_PAGE_SNAPSHOT_URL],
  "/app/billing": [CONSOLE_BILLING_PAGE_SNAPSHOT_URL],
  "/app/cluster": [CONSOLE_ADMIN_CLUSTER_PAGE_SNAPSHOT_URL],
  "/app/cluster-nodes": [CONSOLE_CLUSTER_NODES_PAGE_SNAPSHOT_URL],
  "/app/settings": [CONSOLE_WORKSPACE_SETTINGS_PAGE_SNAPSHOT_URL],
  "/app/settings/workspace": [CONSOLE_WORKSPACE_SETTINGS_PAGE_SNAPSHOT_URL],
  "/app/users": [CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL],
};

function mergeSnapshotValue(key: string, previous: unknown, next: unknown) {
  if (
    key === CONSOLE_BILLING_PAGE_SNAPSHOT_URL &&
    previous &&
    next &&
    typeof previous === "object" &&
    typeof next === "object"
  ) {
    const previousBillingSnapshot = previous as ConsoleBillingPageSnapshot;
    const nextBillingSnapshot = next as ConsoleBillingPageSnapshot;
    if (
      previousBillingSnapshot.state === "ready" &&
      nextBillingSnapshot.state === "ready"
    ) {
      let didMerge = false;
      let mergedBilling = nextBillingSnapshot.data.billing;
      let mergedImageStorageBytes = nextBillingSnapshot.data.imageStorageBytes;

      if (
        previousBillingSnapshot.data.billing &&
        !nextBillingSnapshot.data.billing &&
        nextBillingSnapshot.data.syncError
      ) {
        mergedBilling = previousBillingSnapshot.data.billing;
        didMerge = true;
      }

      if (
        previousBillingSnapshot.data.imageStorageBytes !== null &&
        nextBillingSnapshot.data.imageStorageBytes === null &&
        nextBillingSnapshot.data.syncError
      ) {
        mergedImageStorageBytes = previousBillingSnapshot.data.imageStorageBytes;
        didMerge = true;
      }

      if (didMerge) {
        return {
          ...nextBillingSnapshot,
          data: {
            ...nextBillingSnapshot.data,
            billing: mergedBilling,
            imageStorageBytes: mergedImageStorageBytes,
          },
        } satisfies ConsoleBillingPageSnapshot;
      }
    }
  }

  return next;
}

function readSnapshotEntry(key: string) {
  return snapshotCache.get(key) ?? null;
}

function hasFreshSnapshot(key: string, ttlMs = DEFAULT_CONSOLE_PAGE_SNAPSHOT_TTL_MS) {
  const entry = readSnapshotEntry(key);

  if (!entry) {
    return false;
  }

  return Date.now() - entry.cachedAt < ttlMs;
}

export function readConsolePageSnapshot<T>(
  key: string,
  options?: {
    allowStale?: boolean;
    ttlMs?: number;
  },
) {
  const entry = readSnapshotEntry(key);

  if (!entry) {
    return null;
  }

  if (!options?.allowStale && !hasFreshSnapshot(key, options?.ttlMs)) {
    return null;
  }

  return entry.value as T;
}

export function writeConsolePageSnapshot<T>(key: string, value: T) {
  const mergedValue = mergeSnapshotValue(
    key,
    readConsolePageSnapshot(key, {
      allowStale: true,
    }),
    value,
  ) as T;

  snapshotCache.set(key, {
    cachedAt: Date.now(),
    value: mergedValue,
  });
}

export function invalidateConsolePageSnapshot(key: string) {
  snapshotCache.delete(key);
  snapshotRequests.delete(key);
}

export async function fetchConsolePageSnapshot<T>(
  key: string,
  options?: SnapshotFetchOptions,
) {
  if (options?.signal?.aborted) {
    throw createAbortRequestError();
  }

  if (!options?.force) {
    const cached = readConsolePageSnapshot<T>(key, {
      ttlMs: options?.ttlMs,
    });

    if (cached) {
      return cached;
    }

  }

  const pending = snapshotRequests.get(key);

  if (pending) {
    return pending as Promise<T>;
  }

  const request = requestJson<T>(key, {
    cache: "no-store",
  })
    .then((value) => {
      writeConsolePageSnapshot(key, value);

      return (
        readConsolePageSnapshot<T>(key, {
          allowStale: true,
          ttlMs: options?.ttlMs,
        }) ?? value
      );
    })
    .finally(() => {
      if (snapshotRequests.get(key) === request) {
        snapshotRequests.delete(key);
      }
    });

  snapshotRequests.set(key, request);
  return request;
}

export async function warmConsolePageSnapshot(
  key: string,
  options?: SnapshotFetchOptions,
) {
  try {
    await fetchConsolePageSnapshot(key, options);
  } catch (error) {
    if (options?.signal?.aborted || isAbortRequestError(error)) {
      return;
    }
  }
}

export async function warmConsoleRouteData(
  href: string,
  options?: SnapshotFetchOptions,
) {
  const keys = CONSOLE_ROUTE_SNAPSHOT_URLS[href] ?? [];

  if (!keys.length) {
    return;
  }

  await Promise.all(
    keys.map((key) =>
      warmConsolePageSnapshot(key, {
        signal: options?.signal,
        ttlMs: options?.ttlMs,
      }),
    ),
  );
}

export function useConsolePageSnapshot<T>(
  key: string,
  options?: {
    enabled?: boolean;
    ttlMs?: number;
  },
): UseConsolePageSnapshotResult<T> {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(() =>
    enabled
      ? readConsolePageSnapshot<T>(key, {
          allowStale: true,
          ttlMs: options?.ttlMs,
        })
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    enabled &&
      readConsolePageSnapshot<T>(key, {
        allowStale: true,
        ttlMs: options?.ttlMs,
      }) === null,
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const cached = readConsolePageSnapshot<T>(key, {
      allowStale: true,
      ttlMs: options?.ttlMs,
    });

    if (cached) {
      setData(cached);
      setLoading(false);

      if (hasFreshSnapshot(key, options?.ttlMs)) {
        setError(null);
        return;
      }
    } else {
      setLoading(true);
    }

    fetchConsolePageSnapshot<T>(key, {
      ttlMs: options?.ttlMs,
    })
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setData(nextData);
          setError(null);
          setLoading(false);
        });
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        if (isAbortRequestError(nextError)) {
          const fallbackData = readConsolePageSnapshot<T>(key, {
            allowStale: true,
            ttlMs: options?.ttlMs,
          });

          if (fallbackData) {
            startTransition(() => {
              setData(fallbackData);
              setError(null);
              setLoading(false);
            });
            return;
          }

          setError(null);
          setLoading(false);
          return;
        }

        setError(readRequestError(nextError));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, key, options?.ttlMs]);

  return {
    data,
    error,
    loading,
    refresh: async (refreshOptions?: SnapshotFetchOptions) => {
      try {
        const nextData = await fetchConsolePageSnapshot<T>(key, {
          force: refreshOptions?.force ?? true,
          signal: refreshOptions?.signal,
          ttlMs: options?.ttlMs,
        });

        startTransition(() => {
          setData(nextData);
          setError(null);
          setLoading(false);
        });

        return nextData;
      } catch (error) {
        if (isAbortRequestError(error)) {
          const fallbackData = readConsolePageSnapshot<T>(key, {
            allowStale: true,
            ttlMs: options?.ttlMs,
          });

          if (fallbackData) {
            startTransition(() => {
              setData(fallbackData);
              setError(null);
              setLoading(false);
            });

            return fallbackData;
          }
        }

        throw error;
      }
    },
  };
}

export type {
  ConsoleAdminAppsPageSnapshot,
  ConsoleAdminClusterPageSnapshot,
  ConsoleAdminUsersPageSnapshot,
  ConsoleApiKeysPageSnapshot,
  ConsoleBillingPageSnapshot,
  ConsoleClusterNodesPageSnapshot,
  ConsoleWorkspaceSettingsPageSnapshot,
};
