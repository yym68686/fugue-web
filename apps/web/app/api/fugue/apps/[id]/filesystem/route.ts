import { NextResponse } from "next/server";

import { deleteFugueAppFilesystemPath } from "@/lib/fugue/api";
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

function readOptionalBoolean(value: string | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path")?.trim() ?? "";

  if (!path) {
    return jsonError(400, "Path is required.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await deleteFugueAppFilesystemPath(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        path,
        recursive: readOptionalBoolean(url.searchParams.get("recursive")),
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
