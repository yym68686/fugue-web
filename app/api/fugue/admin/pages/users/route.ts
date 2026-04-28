import { after, NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const access = await requireAdminSnapshotApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    if (readIncludeUsage(request)) {
      after(async () => {
        try {
          await refreshAdminUsersUsageData();
        } catch (error) {
          console.error("Admin users usage background sync failed.", error);
        }
      });

      return jsonSnapshot(await getAdminUsersUsageDataFast());
    }

    after(async () => {
      const results = await Promise.allSettled([
        refreshAdminUsersPageData(),
        refreshAdminUsersUsageData(),
        getAdminUsersPageEnrichmentData(),
      ]);

      if (results[0].status === "rejected") {
        console.error("Admin users page background sync failed.", results[0].reason);
      }

      if (results[1].status === "rejected") {
        console.error("Admin users usage background sync failed.", results[1].reason);
      }

      if (results[2].status === "rejected") {
        console.error(
          "Admin users enrichment background sync failed.",
          results[2].reason,
        );
      }
    });

    return jsonSnapshot(await getAdminUsersPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
