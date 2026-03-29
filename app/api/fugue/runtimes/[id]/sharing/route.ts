import { NextResponse } from "next/server";

import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  requireSession,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { readRuntimeSharingForEmail } from "@/lib/runtimes/service";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type RouteContext = RouteContextWithParams<"id">;

export async function GET(_request: Request, context: RouteContext) {
  const { response, session } = await requireSession();

  if (response || !session) {
    return response;
  }

  try {
    await ensureWorkspaceAccess(session);
    const runtimeId = await readRouteParam(context, "id");
    const sharing = await readRuntimeSharingForEmail(session.email, runtimeId);

    return NextResponse.json({ sharing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
