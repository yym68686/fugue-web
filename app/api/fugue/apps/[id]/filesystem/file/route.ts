import { NextResponse } from "next/server";

import {
  getFugueAppFilesystemFile,
  putFugueAppFilesystemFile,
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
  const path = url.searchParams.get("path")?.trim() ?? "";

  if (!path) {
    return jsonError(400, "Path is required.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await getFugueAppFilesystemFile(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        maxBytes: readOptionalNumber(url.searchParams.get("max_bytes")),
        path,
        pod: url.searchParams.get("pod")?.trim() || undefined,
      },
    );

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

  const path = typeof body.path === "string" ? body.path.trim() : "";

  if (!path) {
    return jsonError(400, "Path is required.");
  }

  if (typeof body.content !== "string") {
    return jsonError(400, "Content must be a string.");
  }

  const encoding =
    body.encoding === "base64" || body.encoding === "utf-8" ? body.encoding : undefined;
  const mkdirParents =
    typeof body.mkdir_parents === "boolean" ? body.mkdir_parents : undefined;
  const mode =
    typeof body.mode === "number" && Number.isFinite(body.mode) ? body.mode : undefined;

  try {
    const appId = await readRouteParam(context, "id");
    const result = await putFugueAppFilesystemFile(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        content: body.content,
        encoding,
        mkdirParents,
        mode,
        path,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
