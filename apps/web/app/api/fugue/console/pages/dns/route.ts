import { NextResponse } from "next/server";

import type { ConsoleDNSPageSnapshot } from "@/lib/console/page-snapshot-types";
import { getDNSPageDataForWorkspace } from "@/lib/dns/service";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleDNSPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    const workspaceState = await requireWorkspaceForSession(session);

    if (workspaceState.response || !workspaceState.workspace) {
      return jsonSnapshot({
        state: "workspace-missing",
      });
    }

    return jsonSnapshot({
      data: await getDNSPageDataForWorkspace(session.email, workspaceState.workspace),
      state: "ready",
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
