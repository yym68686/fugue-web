import { NextResponse } from "next/server";

import { requireAdminSnapshotApiSession } from "@/lib/admin/auth";
import {
  getAdminAppsPageData,
  getAdminAppsUsageDataFast,
  refreshAdminAppsPageData,
  refreshAdminAppsUsageData,
} from "@/lib/admin/service";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

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

function scheduleAdminAppsBackgroundSync(options: {
  page?: boolean;
  usage?: boolean;
}) {
  const now = Date.now();
  const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];

  if (options.page && now >= nextAdminAppsPageSyncAt) {
    nextAdminAppsPageSyncAt = now + ADMIN_APPS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "page",
      run: refreshAdminAppsPageData,
    });
  }

  if (options.usage && now >= nextAdminAppsUsageSyncAt) {
    nextAdminAppsUsageSyncAt = now + ADMIN_APPS_BACKGROUND_SYNC_INTERVAL_MS;
    tasks.push({
      label: "usage",
      run: refreshAdminAppsUsageData,
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
      scheduleAdminAppsBackgroundSync({ usage: true });

      return jsonSnapshot(await getAdminAppsUsageDataFast());
    }

    scheduleAdminAppsBackgroundSync({ page: true, usage: true });

    return jsonSnapshot(await getAdminAppsPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
