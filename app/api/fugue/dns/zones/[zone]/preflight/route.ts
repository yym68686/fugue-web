import { NextResponse } from "next/server";

import { preflightFugueHostedDNSZone } from "@/lib/fugue/api";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"zone">;

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
    const zone = await readRouteParam(context, "zone");
    const minHealthyNodesRaw = new URL(request.url).searchParams.get("minHealthyNodes");
    const minHealthyNodes = minHealthyNodesRaw ? Number(minHealthyNodesRaw) : undefined;

    return NextResponse.json(
      await preflightFugueHostedDNSZone(workspaceState.workspace.adminKeySecret, zone, {
        ...(Number.isFinite(minHealthyNodes) && minHealthyNodes
          ? { minHealthyNodes }
          : {}),
      }),
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
