import { NextResponse } from "next/server";

import { listFugueAppObservabilityRequests } from "@/lib/fugue/api";
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

function readOptionalBoolean(value: string | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
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
    const result = await listFugueAppObservabilityRequests(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        errors: readOptionalBoolean(url.searchParams.get("errors")),
        limit: readOptionalNumber(url.searchParams.get("limit")),
        since: url.searchParams.get("since") ?? undefined,
        slow: readOptionalBoolean(url.searchParams.get("slow")),
        statusClass: url.searchParams.get("status_class")?.trim() || undefined,
        traceId: url.searchParams.get("trace_id")?.trim() || undefined,
        until: url.searchParams.get("until") ?? undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
