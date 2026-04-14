import { after, NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import {
  getAdminUsersPageData,
  getAdminUsersPageEnrichmentData,
  getAdminUsersUsageData,
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
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    if (readIncludeUsage(request)) {
      return jsonSnapshot(await getAdminUsersUsageData());
    }

    after(async () => {
      const results = await Promise.allSettled([
        getAdminUsersUsageData(),
        getAdminUsersPageEnrichmentData(),
      ]);

      if (results[0].status === "rejected") {
        console.error("Admin users usage background sync failed.", results[0].reason);
      }

      if (results[1].status === "rejected") {
        console.error(
          "Admin users enrichment background sync failed.",
          results[1].reason,
        );
      }
    });

    return jsonSnapshot(await getAdminUsersPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
