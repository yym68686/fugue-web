import { NextResponse } from "next/server";

import { createFugueAppFilesystemDirectory } from "@/lib/fugue/api";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id">;

export async function POST(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  if (!isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";

  if (!path) {
    return jsonError(400, "Path is required.");
  }

  const mode =
    typeof body.mode === "number" && Number.isFinite(body.mode) ? body.mode : undefined;
  const parents = typeof body.parents === "boolean" ? body.parents : undefined;

  try {
    const appId = await readRouteParam(context, "id");
    const result = await createFugueAppFilesystemDirectory(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        mode,
        parents,
        path,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
