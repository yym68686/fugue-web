import { NextResponse } from "next/server";

import {
  createFugueAppDomain,
  deleteFugueAppDomain,
  getFugueAppDomains,
} from "@/lib/fugue/api";
import { readFugueDomainAccessToken } from "@/lib/fugue/domain-route-access";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
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
    const appId = await readRouteParam(context, "id");
    const result = await getFugueAppDomains(workspaceState.workspace.adminKeySecret, appId);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function POST(request: Request, context: RouteContext) {
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

  try {
    const appId = await readRouteParam(context, "id");
    const accessToken = await readFugueDomainAccessToken(
      session,
      workspaceState.workspace,
      appId,
      readOptionalString(body, "hostname"),
    );
    const result = await createFugueAppDomain(accessToken, appId, {
      hostname: readOptionalString(body, "hostname"),
    });

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
    const hostname = new URL(request.url).searchParams.get("hostname") ?? "";
    const result = await deleteFugueAppDomain(
      workspaceState.workspace.adminKeySecret,
      appId,
      hostname,
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
