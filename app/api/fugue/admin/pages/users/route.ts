import { NextResponse } from "next/server";

import { requireAdminSnapshotApiSession } from "@/lib/admin/auth";
import {
  getAdminUsersPageData,
  getAdminUsersPageEnrichmentData,
  getAdminUsersUsageDataFast,
  refreshAdminUsersPageData,
  refreshAdminUsersUsageData,
} from "@/lib/admin/service";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

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

function scheduleAdminUsersBackgroundSync(options: {
  enrichment?: boolean;
  page?: boolean;
  usage?: boolean;
}) {
  const now = Date.now();
  const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];

  if (options.page && now >= nextAdminUsersPageSyncAt) {
    nextAdminUsersPageSyncAt = now + ADMIN_USERS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "page",
      run: refreshAdminUsersPageData,
    });
  }

  if (options.usage && now >= nextAdminUsersUsageSyncAt) {
    nextAdminUsersUsageSyncAt = now + ADMIN_USERS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "usage",
      run: refreshAdminUsersUsageData,
    });
  }

  if (options.enrichment && now >= nextAdminUsersEnrichmentSyncAt) {
    nextAdminUsersEnrichmentSyncAt =
      now + ADMIN_USERS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "enrichment",
      run: getAdminUsersPageEnrichmentData,
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
            result.reason,
          );
        }
      }
    });
  }, 0);
}

export async function GET(request: Request) {
  const access = await requireAdminSnapshotApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    if (readIncludeUsage(request)) {
      scheduleAdminUsersBackgroundSync({ usage: true });

      return jsonSnapshot(await getAdminUsersUsageDataFast());
    }

    scheduleAdminUsersBackgroundSync({
      enrichment: true,
      page: true,
      usage: true,
    });

    return jsonSnapshot(await getAdminUsersPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
