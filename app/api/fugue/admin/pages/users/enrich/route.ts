import { NextResponse } from "next/server";

import { requireAdminSnapshotApiSession } from "@/lib/admin/auth";
import { getAdminUsersPageEnrichmentData } from "@/lib/admin/service";
import type { ConsoleAdminUsersPageEnrichmentSnapshot } from "@/lib/console/page-snapshot-types";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleAdminUsersPageEnrichmentSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const access = await requireAdminSnapshotApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    return jsonSnapshot(await getAdminUsersPageEnrichmentData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
