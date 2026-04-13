import { NextResponse } from "next/server";

import type { ConsoleClusterNodesPageSnapshot } from "@/lib/console/page-snapshot-types";
import { getClusterNodesPageData } from "@/lib/cluster-nodes/service";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
} from "@/lib/fugue/product-route";
import { getRequestLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleClusterNodesPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const { response, session, user } = await requireSession();

  if (response || !session || !user) {
    return response;
  }

  try {
    const locale = await getRequestLocale();
    const data = await getClusterNodesPageData(session.email, locale);

    if (!data) {
      return jsonSnapshot({
        state: "workspace-missing",
      });
    }

    return jsonSnapshot({
      data,
      isAdmin: user.isAdmin,
      state: "ready",
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
