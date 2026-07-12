import { NextResponse } from "next/server";

import { requireAdminSnapshotApiSession } from "@/lib/admin/auth";
import {
  getAdminUsersBoundedPageData,
  getAdminUsersPageData,
  getAdminUsersPageEnrichmentData,
  getAdminUsersUsageDataFast,
  refreshAdminUsersPageData,
  refreshAdminUsersUsageData,
} from "@/lib/admin/service";
import type { AppUserPageFilter } from "@/lib/app-users/store";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import type { Locale } from "@/lib/i18n/core";
import { getRequestLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const ADMIN_USERS_BACKGROUND_SYNC_INTERVAL_MS = 30_000;

let nextAdminUsersEnrichmentSyncAt = 0;
let nextAdminUsersPageSyncAt = 0;
let nextAdminUsersUsageSyncAt = 0;

function jsonSnapshot(snapshot: unknown) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function readIncludeUsage(request: Request) {
  return new URL(request.url).searchParams.get("include_usage") === "1";
}

function readBoundedPageQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  const enabled = ["limit", "cursor", "q", "status"].some((key) => params.has(key));

  if (!enabled) {
    return null;
  }

  const rawLimit = params.get("limit")?.trim() || "50";
  const limit = Number.parseInt(rawLimit, 10);
  if (
    !/^\d+$/.test(rawLimit) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error("400 limit must be between 1 and 100.");
  }
  const rawStatus = params.get("status")?.trim() || "all";
  if (
    rawStatus !== "all" &&
    rawStatus !== "active" &&
    rawStatus !== "blocked" &&
    rawStatus !== "deleted" &&
    rawStatus !== "admin"
  ) {
    throw new Error("400 Unsupported user status filter.");
  }

  return {
    cursor: params.get("cursor")?.trim() || undefined,
    limit,
    query: params.get("q")?.trim() || undefined,
    status: rawStatus as AppUserPageFilter,
  };
}

function scheduleAdminUsersBackgroundSync(options: {
  enrichment?: boolean;
  locale: Locale;
  page?: boolean;
  usage?: boolean;
}) {
  const now = Date.now();
  const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];

  if (options.page && now >= nextAdminUsersPageSyncAt) {
    nextAdminUsersPageSyncAt = now + ADMIN_USERS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "page",
      run: () => refreshAdminUsersPageData(options.locale),
    });
  }

  if (options.usage && now >= nextAdminUsersUsageSyncAt) {
    nextAdminUsersUsageSyncAt = now + ADMIN_USERS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "usage",
      run: () => refreshAdminUsersUsageData(options.locale),
    });
  }

  if (options.enrichment && now >= nextAdminUsersEnrichmentSyncAt) {
    nextAdminUsersEnrichmentSyncAt = now + ADMIN_USERS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "enrichment",
      run: () => getAdminUsersPageEnrichmentData(options.locale),
    });
  }

  if (!tasks.length) {
    return;
  }

  setTimeout(() => {
    void Promise.allSettled(tasks.map((task) => task.run())).then((results) => {
      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
          const task = tasks[index];
          console.error(
            `Admin users ${task?.label ?? "snapshot"} background sync failed.`,
            {
              category: result.reason instanceof Error ? result.reason.name : "unknown",
            },
          );
        }
      }
    });
  }, 0);
}

export async function GET(request: Request) {
  const access = await requireAdminSnapshotApiSession("admin.snapshot.users.read");

  if (access.response) {
    return access.response;
  }

  try {
    const locale = await getRequestLocale();

    if (readIncludeUsage(request)) {
      scheduleAdminUsersBackgroundSync({ locale, usage: true });

      return jsonSnapshot(await getAdminUsersUsageDataFast(locale));
    }

    const boundedQuery = readBoundedPageQuery(request);
    if (boundedQuery) {
      return jsonSnapshot(await getAdminUsersBoundedPageData(boundedQuery, locale));
    }

    scheduleAdminUsersBackgroundSync({
      enrichment: true,
      locale,
      page: true,
      usage: true,
    });

    return jsonSnapshot(await getAdminUsersPageData(locale));
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
