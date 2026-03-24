import { NextResponse } from "next/server";

import {
  deleteFugueAppFiles,
  getFugueAppFiles,
  putFugueAppFiles,
} from "@/lib/fugue/api";
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

function readFiles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const path = typeof record.path === "string" ? record.path.trim() : "";

    if (!path) {
      return [];
    }

    return [
      {
        ...(typeof record.content === "string" ? { content: record.content } : {}),
        ...(typeof record.mode === "number" && Number.isFinite(record.mode)
          ? { mode: record.mode }
          : {}),
        ...(typeof record.secret === "boolean" ? { secret: record.secret } : {}),
        path,
      },
    ];
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await getFugueAppFiles(workspaceState.workspace.adminKeySecret, appId);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function PUT(request: Request, context: RouteContext) {
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

  const files = readFiles(body.files);

  if (!files.length) {
    return jsonError(400, "At least one file is required.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await putFugueAppFiles(workspaceState.workspace.adminKeySecret, appId, files);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
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
  const paths = url.searchParams
    .getAll("path")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!paths.length) {
    return jsonError(400, "At least one file path is required.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await deleteFugueAppFiles(workspaceState.workspace.adminKeySecret, appId, paths);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
