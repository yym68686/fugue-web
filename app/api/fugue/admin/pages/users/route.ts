import { after, NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { getAdminUsersPageData, getAdminUsersUsageData } from "@/lib/admin/service";
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
      try {
        await getAdminUsersUsageData();
      } catch (error) {
        console.error("Admin users usage background sync failed.", error);
      }
    });

    return jsonSnapshot(await getAdminUsersPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
