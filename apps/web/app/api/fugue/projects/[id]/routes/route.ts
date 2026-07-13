import { NextResponse } from "next/server";

import {
  deleteFugueProjectRouteTable,
  getFugueProjectRouteTable,
  putFugueProjectRouteTable,
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
    const projectId = await readRouteParam(context, "id");
    const result = await getFugueProjectRouteTable(
      workspaceState.workspace.adminKeySecret,
      projectId,
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

  if (!Array.isArray(body.domains) || !Array.isArray(body.entrypoints)) {
    return jsonError(400, "Request body must include domains and entrypoints arrays.");
  }

  try {
    const projectId = await readRouteParam(context, "id");
    const result = await putFugueProjectRouteTable(
      workspaceState.workspace.adminKeySecret,
      projectId,
      {
        domains: body.domains,
        entrypoints: body.entrypoints,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  try {
    const projectId = await readRouteParam(context, "id");
    const result = await deleteFugueProjectRouteTable(
      workspaceState.workspace.adminKeySecret,
      projectId,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
