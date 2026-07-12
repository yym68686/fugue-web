import { NextResponse } from "next/server";

import { deleteFugueProjectRuntimeReservation } from "@/lib/fugue/api";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id" | "runtimeId">;

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
    const runtimeId = await readRouteParam(context, "runtimeId");
    const reservation = await deleteFugueProjectRuntimeReservation(
      workspaceState.workspace.adminKeySecret,
      projectId,
      runtimeId,
    );

    return NextResponse.json({
      deleted: true,
      runtimeReservation: reservation,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
