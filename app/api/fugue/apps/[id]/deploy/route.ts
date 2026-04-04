import { NextResponse } from "next/server";

import { deployFugueApp } from "@/lib/fugue/api";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id">;

const DEFAULT_WORKSPACE_MOUNT_PATH = "/workspace";

export async function POST(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  const rawBody = await request.text();
  let body: unknown = {};

  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError(400, "Invalid JSON body.");
    }
  }

  if (!isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const mountPath = readOptionalString(body, "mountPath");

  try {
    const appId = await readRouteParam(context, "id");
    const result = await deployFugueApp(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        workspace: {
          mount_path: mountPath || DEFAULT_WORKSPACE_MOUNT_PATH,
        },
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
