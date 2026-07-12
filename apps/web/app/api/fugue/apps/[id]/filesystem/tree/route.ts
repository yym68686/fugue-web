import { NextResponse } from "next/server";

import { getFugueAppFilesystemTree } from "@/lib/fugue/api";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id">;

function readOptionalNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  const url = new URL(request.url);

  try {
    const appId = await readRouteParam(context, "id");
    const result = await getFugueAppFilesystemTree(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        depth: readOptionalNumber(url.searchParams.get("depth")),
        path: url.searchParams.get("path")?.trim() || undefined,
        pod: url.searchParams.get("pod")?.trim() || undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
