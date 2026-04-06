import { NextResponse } from "next/server";

import { deleteFugueApp, patchFugueApp } from "@/lib/fugue/api";
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

function hasOwnField(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readOptionalInteger(record: Record<string, unknown>, key: string) {
  if (!hasOwnField(record, key)) {
    return undefined;
  }

  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (!Number.isInteger(value)) {
    return null;
  }

  return value;
}

function readOptionalStringField(record: Record<string, unknown>, key: string) {
  if (!hasOwnField(record, key)) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "string" ? value : null;
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const imageMirrorLimit = readOptionalInteger(body, "imageMirrorLimit");

  const startupCommand = readOptionalStringField(body, "startupCommand");

  if (imageMirrorLimit === null) {
    return jsonError(400, "imageMirrorLimit must be a whole number.");
  }

  if (startupCommand === null) {
    return jsonError(400, "startupCommand must be a string.");
  }

  if (imageMirrorLimit === undefined && startupCommand === undefined) {
    return jsonError(400, "Provide imageMirrorLimit or startupCommand.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await patchFugueApp(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        ...(imageMirrorLimit !== undefined ? { imageMirrorLimit } : {}),
        ...(startupCommand !== undefined ? { startupCommand } : {}),
      },
    );

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

  try {
    const appId = await readRouteParam(context, "id");
    const force = new URL(request.url).searchParams.get("force") === "true";
    const result = await deleteFugueApp(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        force,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
