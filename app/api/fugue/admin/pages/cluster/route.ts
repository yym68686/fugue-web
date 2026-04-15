import { NextResponse } from "next/server";

import { requireAdminSnapshotApiSession } from "@/lib/admin/auth";
import {
  getAdminClusterPageData,
  getAdminControlPlaneData,
} from "@/lib/admin/service";
import type { ConsoleAdminClusterPageSnapshot } from "@/lib/console/page-snapshot-types";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleAdminClusterPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function readIncludeControlPlane(request: Request) {
  return (
    new URL(request.url).searchParams.get("include_control_plane") === "1"
  );
}

export async function GET(request: Request) {
  const access = await requireAdminSnapshotApiSession();

  if (access.response) {
    return access.response;
  }

  try {
    if (readIncludeControlPlane(request)) {
      return NextResponse.json(await getAdminControlPlaneData(), {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    return jsonSnapshot(await getAdminClusterPageData());
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
