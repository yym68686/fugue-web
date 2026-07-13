import { NextResponse } from "next/server";

import { requireAdminSnapshotApiSession } from "@/lib/admin/auth";
import {
  getAdminAppsBoundedPageData,
  getAdminAppsPageData,
  getAdminAppsUsageDataFast,
  refreshAdminAppsPageData,
  refreshAdminAppsUsageData,
} from "@/lib/admin/service";
import type { FugueAppListSort } from "@/lib/fugue/api";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { getRequestLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

const ADMIN_APPS_BACKGROUND_SYNC_INTERVAL_MS = 30_000;

let nextAdminAppsPageSyncAt = 0;
let nextAdminAppsUsageSyncAt = 0;

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
  const enabled = ["limit", "cursor", "q", "phase", "sort"].some((key) =>
    params.has(key),
  );

  if (!enabled) {
    return null;
  }

  const rawLimit = params.get("limit")?.trim() || "50";
  const limit = Number.parseInt(rawLimit, 10);
  if (
    !/^\d+$/.test(rawLimit) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 200
  ) {
    throw new Error("400 limit must be between 1 and 200.");
  }
  const rawSort = params.get("sort")?.trim() || "created_at_desc";
  if (
    rawSort !== "created_at_desc" &&
    rawSort !== "created_at_asc" &&
    rawSort !== "updated_at_desc" &&
    rawSort !== "name_asc"
  ) {
    throw new Error("400 Unsupported app sort.");
  }

  return {
    cursor: params.get("cursor")?.trim() || undefined,
    limit,
    phase: params.get("phase")?.trim() || undefined,
    query: params.get("q")?.trim() || undefined,
    sort: rawSort as FugueAppListSort,
  };
}

function scheduleAdminAppsBackgroundSync(options: {
  locale: Locale;
  page?: boolean;
  usage?: boolean;
}) {
  const now = Date.now();
  const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];

  if (options.page && now >= nextAdminAppsPageSyncAt) {
    nextAdminAppsPageSyncAt = now + ADMIN_APPS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "page",
      run: () => refreshAdminAppsPageData(options.locale),
    });
  }

  if (options.usage && now >= nextAdminAppsUsageSyncAt) {
    nextAdminAppsUsageSyncAt = now + ADMIN_APPS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "usage",
      run: () => refreshAdminAppsUsageData(options.locale),
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
            `Admin apps ${task?.label ?? "snapshot"} background sync failed.`,
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
  const access = await requireAdminSnapshotApiSession("admin.snapshot.apps.read");

  if (access.response) {
    return access.response;
  }

  try {
    const locale = await getRequestLocale();

    if (readIncludeUsage(request)) {
      scheduleAdminAppsBackgroundSync({ locale, usage: true });

      return jsonSnapshot(await getAdminAppsUsageDataFast(locale));
    }

    const boundedQuery = readBoundedPageQuery(request);
    if (boundedQuery) {
      return jsonSnapshot(await getAdminAppsBoundedPageData(boundedQuery, locale));
    }

    scheduleAdminAppsBackgroundSync({ locale, page: true, usage: true });

    return jsonSnapshot(await getAdminAppsPageData(locale));
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
