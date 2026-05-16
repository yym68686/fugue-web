import { NextResponse } from "next/server";

import { syncFugueAppImage } from "@/lib/fugue/api";
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

  if (body !== null && !isObject(body)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  try {
    const appId = await readRouteParam(context, "id");
    const result = await syncFugueAppImage(
      workspaceState.workspace.adminKeySecret,
      appId,
      isObject(body)
        ? {
            deliveryId: readOptionalString(body, "deliveryId") || undefined,
            event: readOptionalString(body, "event") || "manual",
            imageRef: readOptionalString(body, "imageRef") || undefined,
          }
        : { event: "manual" },
    );

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
