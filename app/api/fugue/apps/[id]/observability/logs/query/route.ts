import { NextResponse } from "next/server";

import { queryFugueAppObservabilityLogs } from "@/lib/fugue/api";
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

  try {
    const appId = await readRouteParam(context, "id");
    const url = new URL(request.url);
    const result = await queryFugueAppObservabilityLogs(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        grep: url.searchParams.get("grep")?.trim() || undefined,
        level: url.searchParams.get("level")?.trim() || undefined,
        limit: readOptionalNumber(url.searchParams.get("limit")),
        since: url.searchParams.get("since") ?? undefined,
        traceId: url.searchParams.get("trace_id")?.trim() || undefined,
        until: url.searchParams.get("until") ?? undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
