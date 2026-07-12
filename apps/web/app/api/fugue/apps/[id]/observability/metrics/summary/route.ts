import { NextResponse } from "next/server";

import { getFugueAppObservabilityMetricsSummary } from "@/lib/fugue/api";
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
    const url = new URL(request.url);
    const result = await getFugueAppObservabilityMetricsSummary(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        since: url.searchParams.get("since") ?? undefined,
        until: url.searchParams.get("until") ?? undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
