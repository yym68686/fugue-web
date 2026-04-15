import { NextResponse } from "next/server";

import { deleteFugueProject, patchFugueProject } from "@/lib/fugue/api";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { saveWorkspaceAccess } from "@/lib/workspace/store";

type RouteContext = RouteContextWithParams<"id">;

function asRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOptionalString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
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

  try {
    const projectId = await readRouteParam(context, "id");
    const body = asRecord(await request.json().catch(() => null));
    const result = await patchFugueProject(workspaceState.workspace.adminKeySecret, projectId, {
      description: readOptionalString(body, "description"),
      name: readOptionalString(body, "name"),
    });

    if (workspaceState.workspace.defaultProjectId === result.id) {
      await saveWorkspaceAccess({
        ...workspaceState.workspace,
        defaultProjectName: result.name,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ project: result });
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
    const cascade = new URL(_request.url).searchParams.get("cascade") === "true";
    const result = await deleteFugueProject(
      workspaceState.workspace.adminKeySecret,
      projectId,
      {
        cascade,
      },
    );

    if (
      result.project &&
      (result.deleted || result.deleteRequested) &&
      workspaceState.workspace.defaultProjectId === result.project.id
    ) {
      await saveWorkspaceAccess({
        ...workspaceState.workspace,
        defaultProjectId: null,
        defaultProjectName: null,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
