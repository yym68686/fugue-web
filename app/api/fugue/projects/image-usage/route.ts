import { NextResponse } from "next/server";

import { getFugueProjectImageUsage } from "@/lib/fugue/api";
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
    const result = await getFugueProjectImageUsage(
      workspaceState.workspace.adminKeySecret,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
