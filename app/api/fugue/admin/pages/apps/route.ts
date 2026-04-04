import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import { getAdminAppsPageData } from "@/lib/admin/service";
import type { ConsoleAdminAppsPageSnapshot } from "@/lib/console/page-snapshot-types";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleAdminAppsPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    return jsonSnapshot(await getAdminAppsPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
