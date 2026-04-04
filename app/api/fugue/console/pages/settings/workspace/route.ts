import { NextResponse } from "next/server";

import type { ConsoleWorkspaceSettingsPageSnapshot } from "@/lib/console/page-snapshot-types";
import { getCurrentSession } from "@/lib/auth/session";
import { getConsoleData } from "@/lib/console/presenters";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { getCurrentWorkspaceAccess } from "@/lib/workspace/current";

export const dynamic = "force-dynamic";

function jsonSnapshot(snapshot: ConsoleWorkspaceSettingsPageSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    const [consoleData, workspace] = await Promise.all([
      getConsoleData(),
      getCurrentWorkspaceAccess(),
    ]);

    if (consoleData.workspace.stage === "needs-workspace") {
      return jsonSnapshot({
        state: "workspace-missing",
      });
    }

    return jsonSnapshot({
      consoleData,
      session,
      state: "ready",
      workspace: workspace
        ? {
            adminKeyId: workspace.adminKeyId,
            adminKeyLabel: workspace.adminKeyLabel,
          }
        : null,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
