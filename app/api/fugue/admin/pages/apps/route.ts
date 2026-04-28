import { after, NextResponse } from "next/server";

import { requireAdminSnapshotApiSession } from "@/lib/admin/auth";
import {
  getAdminAppsPageData,
  getAdminAppsUsageData,
  getAdminAppsUsageDataFast,
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
      return jsonSnapshot(await getAdminAppsUsageDataFast());
    }

    after(async () => {
      try {
        await getAdminAppsUsageData();
      } catch (error) {
        console.error("Admin apps usage background sync failed.", error);
      }
    });

    return jsonSnapshot(await getAdminAppsPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
