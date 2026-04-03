import { NextResponse } from "next/server";

import { redeployFugueAppImage } from "@/lib/fugue/api";
import {
  isObject,
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readJsonBody,
  readOptionalString,
  readRouteParam,
  requireSession,
  requireWorkspaceForSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

type RouteContext = RouteContextWithParams<"id">;

export async function POST(request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  const workspaceState = await requireWorkspaceForSession(session);

  if (workspaceState.response || !workspaceState.workspace) {
    return workspaceState.response;
  }

  const body = await readJsonBody(request);

  if (!isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const imageRef = readOptionalString(body, "imageRef");

  if (!imageRef) {
    return jsonError(400, "imageRef is required.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await redeployFugueAppImage(
      workspaceState.workspace.adminKeySecret,
      appId,
      { imageRef },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
