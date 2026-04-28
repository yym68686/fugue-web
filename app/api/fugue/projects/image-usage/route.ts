import { NextResponse } from "next/server";

import {
  getConsoleProjectImageUsageDataForWorkspace,
} from "@/lib/console/gallery-data";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireSession,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";

export async function GET() {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const result = await getConsoleProjectImageUsageDataForWorkspace(
      workspaceState.workspace,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
