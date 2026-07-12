import { NextResponse } from "next/server";

import { getFugueAppRuntimeLogs } from "@/lib/fugue/api";
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

  const url = new URL(request.url);
  const component = url.searchParams.get("component");

  if (component && component !== "app" && component !== "postgres") {
    return jsonError(400, "component must be app or postgres.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await getFugueAppRuntimeLogs(
      workspaceState.workspace.adminKeySecret,
      appId,
      {
        component: component === "postgres" ? "postgres" : "app",
        pod: url.searchParams.get("pod") ?? undefined,
        previous: readOptionalBoolean(url.searchParams.get("previous")),
        tailLines: readOptionalNumber(url.searchParams.get("tail_lines")),
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
