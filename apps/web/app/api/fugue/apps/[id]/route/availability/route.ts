import { NextResponse } from "next/server";

import { getFugueAppRouteAvailability } from "@/lib/fugue/api";
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

export async function GET(request: Request, context: RouteContext) {
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
    const searchParams = new URL(request.url).searchParams;
    const hostname = searchParams.get("hostname") ?? "";
    const pathPrefix = searchParams.get("path_prefix") ?? "";
    const result = await getFugueAppRouteAvailability(
      workspaceState.workspace.adminKeySecret,
      appId,
      hostname,
      pathPrefix,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
